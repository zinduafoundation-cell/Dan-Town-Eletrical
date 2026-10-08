/**
 * Minimal, dependency-free WebAuthn (passkey) verification.
 *
 * Staff use the phone's own fingerprint / face / screen-lock. The biometric
 * never leaves the phone: the phone proves it holds a private key by signing a
 * one-time challenge, and the server only stores the matching PUBLIC key.
 *
 * Supports ES256 (Android, iPhone, Mac) and RS256 (Windows Hello) with
 * "none" attestation, which is all a platform authenticator needs.
 */
import { createHash, createPublicKey, verify as verifySignature, timingSafeEqual } from "node:crypto";

export function toBase64Url(input: Buffer | Uint8Array) {
  return Buffer.from(input).toString("base64url");
}

export function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

/* ---------- tiny CBOR reader (enough for attestation objects & COSE keys) ---------- */

type CborValue = number | bigint | string | boolean | null | Buffer | CborValue[] | Map<CborValue, CborValue>;

function readCbor(buf: Buffer, start = 0): { value: CborValue; end: number } {
  let offset = start;
  const initial = buf[offset++];
  const major = initial >> 5;
  const info = initial & 0x1f;

  function readLength(): number {
    if (info < 24) return info;
    if (info === 24) { const n = buf[offset]; offset += 1; return n; }
    if (info === 25) { const n = buf.readUInt16BE(offset); offset += 2; return n; }
    if (info === 26) { const n = buf.readUInt32BE(offset); offset += 4; return n; }
    throw new Error("Unsupported CBOR length");
  }

  switch (major) {
    case 0: return { value: readLength(), end: offset };
    case 1: return { value: -1 - readLength(), end: offset };
    case 2: { const len = readLength(); const value = buf.subarray(offset, offset + len); return { value: Buffer.from(value), end: offset + len }; }
    case 3: { const len = readLength(); return { value: buf.subarray(offset, offset + len).toString("utf8"), end: offset + len }; }
    case 4: {
      const len = readLength();
      const items: CborValue[] = [];
      for (let i = 0; i < len; i++) { const item = readCbor(buf, offset); items.push(item.value); offset = item.end; }
      return { value: items, end: offset };
    }
    case 5: {
      const len = readLength();
      const map = new Map<CborValue, CborValue>();
      for (let i = 0; i < len; i++) {
        const key = readCbor(buf, offset); offset = key.end;
        const val = readCbor(buf, offset); offset = val.end;
        map.set(key.value, val.value);
      }
      return { value: map, end: offset };
    }
    case 7:
      if (info === 20) return { value: false, end: offset };
      if (info === 21) return { value: true, end: offset };
      if (info === 22 || info === 23) return { value: null, end: offset };
      throw new Error("Unsupported CBOR simple value");
    default:
      throw new Error("Unsupported CBOR type");
  }
}

/* ---------- authenticator data ---------- */

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_ATTESTED = 0x40;

function parseAuthenticatorData(authData: Buffer) {
  if (authData.length < 37) throw new Error("Authenticator data is too short.");
  const parsed = {
    rpIdHash: authData.subarray(0, 32),
    flags: authData[32],
    counter: authData.readUInt32BE(33),
    credentialId: null as Buffer | null,
    coseKey: null as Map<CborValue, CborValue> | null,
  };
  if (parsed.flags & FLAG_ATTESTED) {
    const idLength = authData.readUInt16BE(53);
    parsed.credentialId = Buffer.from(authData.subarray(55, 55 + idLength));
    const key = readCbor(authData, 55 + idLength).value;
    if (!(key instanceof Map)) throw new Error("Credential public key is malformed.");
    parsed.coseKey = key;
  }
  return parsed;
}

function coseToPublicKeySpki(cose: Map<CborValue, CborValue>) {
  const kty = cose.get(1);
  const alg = cose.get(3);
  let keyObject;
  if (kty === 2 && alg === -7) {
    const x = cose.get(-2); const y = cose.get(-3);
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) throw new Error("Malformed ES256 key.");
    keyObject = createPublicKey({ key: { kty: "EC", crv: "P-256", x: toBase64Url(x), y: toBase64Url(y) }, format: "jwk" });
  } else if (kty === 3 && alg === -257) {
    const n = cose.get(-1); const e = cose.get(-2);
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) throw new Error("Malformed RS256 key.");
    keyObject = createPublicKey({ key: { kty: "RSA", n: toBase64Url(n), e: toBase64Url(e) }, format: "jwk" });
  } else {
    throw new Error("This device uses an unsupported key type.");
  }
  return keyObject.export({ type: "spki", format: "der" }) as Buffer;
}

/* ---------- shared checks ---------- */

type ClientData = { type: string; challenge: string; origin: string };

function checkClientData(clientDataJSON: Buffer, expectedType: string, expectedChallenge: string, expectedOrigin: string) {
  const clientData = JSON.parse(clientDataJSON.toString("utf8")) as ClientData;
  if (clientData.type !== expectedType) throw new Error("Unexpected biometric request type.");
  if (clientData.challenge !== expectedChallenge) throw new Error("Biometric challenge did not match.");
  if (clientData.origin !== expectedOrigin) throw new Error("Biometric request came from an unexpected site.");
}

function checkRpIdHash(rpIdHash: Buffer, rpId: string) {
  const expected = createHash("sha256").update(rpId).digest();
  if (rpIdHash.length !== expected.length || !timingSafeEqual(rpIdHash, expected)) throw new Error("Biometric request was for a different site.");
}

function checkFlags(flags: number) {
  if (!(flags & FLAG_USER_PRESENT)) throw new Error("Touch was not confirmed on the device.");
  if (!(flags & FLAG_USER_VERIFIED)) throw new Error("Fingerprint, face or screen lock was not confirmed on the device.");
}

/* ---------- registration ---------- */

export type RegistrationCredential = {
  id: string;
  response: { clientDataJSON: string; attestationObject: string; transports?: string[] };
};

export function verifyRegistration(input: { credential: RegistrationCredential; expectedChallenge: string; expectedOrigin: string; rpId: string }) {
  const clientDataJSON = fromBase64Url(input.credential.response.clientDataJSON);
  checkClientData(clientDataJSON, "webauthn.create", input.expectedChallenge, input.expectedOrigin);

  const attestation = readCbor(fromBase64Url(input.credential.response.attestationObject)).value;
  if (!(attestation instanceof Map)) throw new Error("Biometric registration is malformed.");
  const authData = attestation.get("authData");
  if (!Buffer.isBuffer(authData)) throw new Error("Biometric registration is missing its data.");

  const parsed = parseAuthenticatorData(authData);
  checkRpIdHash(parsed.rpIdHash, input.rpId);
  checkFlags(parsed.flags);
  if (!parsed.credentialId || !parsed.coseKey) throw new Error("Biometric registration did not include a key.");
  if (toBase64Url(parsed.credentialId) !== input.credential.id) throw new Error("Biometric credential id mismatch.");

  return {
    credentialId: input.credential.id,
    publicKey: toBase64Url(coseToPublicKeySpki(parsed.coseKey)),
    counter: parsed.counter,
    transports: input.credential.response.transports ?? [],
  };
}

/* ---------- authentication ---------- */

export type AuthenticationCredential = {
  id: string;
  response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string | null };
};

export function verifyAuthentication(input: {
  credential: AuthenticationCredential;
  expectedChallenge: string;
  expectedOrigin: string;
  rpId: string;
  publicKey: string;
  storedCounter: number;
}) {
  const clientDataJSON = fromBase64Url(input.credential.response.clientDataJSON);
  checkClientData(clientDataJSON, "webauthn.get", input.expectedChallenge, input.expectedOrigin);

  const authData = fromBase64Url(input.credential.response.authenticatorData);
  const parsed = parseAuthenticatorData(authData);
  checkRpIdHash(parsed.rpIdHash, input.rpId);
  checkFlags(parsed.flags);

  const signedData = Buffer.concat([authData, createHash("sha256").update(clientDataJSON).digest()]);
  const publicKey = createPublicKey({ key: fromBase64Url(input.publicKey), format: "der", type: "spki" });
  const signatureOk = verifySignature("sha256", signedData, publicKey, fromBase64Url(input.credential.response.signature));
  if (!signatureOk) throw new Error("Biometric signature was not valid.");

  // A counter that goes backwards means the credential may have been cloned.
  // Many phones always report 0, which is fine.
  if ((parsed.counter !== 0 || input.storedCounter !== 0) && parsed.counter <= input.storedCounter) {
    throw new Error("This biometric credential looks cloned and was blocked.");
  }
  return { newCounter: parsed.counter };
}
