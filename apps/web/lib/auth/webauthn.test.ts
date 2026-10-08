import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fromBase64Url, toBase64Url, verifyAuthentication, verifyRegistration } from "./webauthn";

const rpId = "dantown.example";
const origin = "https://dantown.example";

/** A tiny fake phone: creates a P-256 key and answers like a platform authenticator. */
function fakePhone(flags = 0x05) {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const credentialId = Buffer.from("credential-id-123456");
  const rpIdHash = createHash("sha256").update(rpId).digest();

  const cbor = (bytes: number[]) => Buffer.from(bytes);
  const coseKey = Buffer.concat([
    cbor([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]), Buffer.from(jwk.x, "base64url"),
    cbor([0x22, 0x58, 0x20]), Buffer.from(jwk.y, "base64url"),
  ]);
  const counter = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
  const idLen = Buffer.alloc(2); idLen.writeUInt16BE(credentialId.length);

  function register(challenge: string) {
    const authData = Buffer.concat([rpIdHash, Buffer.from([flags | 0x40]), counter(0), Buffer.alloc(16), idLen, credentialId, coseKey]);
    const attestation = Buffer.concat([
      cbor([0xa3, 0x63]), Buffer.from("fmt"), cbor([0x64]), Buffer.from("none"),
      cbor([0x67]), Buffer.from("attStmt"), cbor([0xa0]),
      cbor([0x68]), Buffer.from("authData"), cbor([0x58, authData.length]), authData,
    ]);
    const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge, origin }));
    return { id: toBase64Url(credentialId), response: { clientDataJSON: toBase64Url(clientDataJSON), attestationObject: toBase64Url(attestation) } };
  }

  function authenticate(challenge: string, count: number, overrideFlags = flags) {
    const authData = Buffer.concat([rpIdHash, Buffer.from([overrideFlags]), counter(count)]);
    const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin }));
    const signature = sign("sha256", Buffer.concat([authData, createHash("sha256").update(clientDataJSON).digest()]), privateKey);
    return { id: toBase64Url(credentialId), response: { clientDataJSON: toBase64Url(clientDataJSON), authenticatorData: toBase64Url(authData), signature: toBase64Url(signature) } };
  }
  return { register, authenticate };
}

describe("passkey verification", () => {
  it("registers a phone and then accepts its signed login", () => {
    const phone = fakePhone();
    const registered = verifyRegistration({ credential: phone.register("abc"), expectedChallenge: "abc", expectedOrigin: origin, rpId });
    expect(fromBase64Url(registered.publicKey).length).toBeGreaterThan(60);

    const result = verifyAuthentication({ credential: phone.authenticate("xyz", 1), expectedChallenge: "xyz", expectedOrigin: origin, rpId, publicKey: registered.publicKey, storedCounter: registered.counter });
    expect(result.newCounter).toBe(1);
  });

  it("rejects a wrong challenge, wrong site, replayed counter and missing biometric", () => {
    const phone = fakePhone();
    const registered = verifyRegistration({ credential: phone.register("abc"), expectedChallenge: "abc", expectedOrigin: origin, rpId });
    const base = { expectedOrigin: origin, rpId, publicKey: registered.publicKey };
    expect(() => verifyAuthentication({ ...base, credential: phone.authenticate("other", 1), expectedChallenge: "xyz", storedCounter: 0 })).toThrow(/challenge/);
    expect(() => verifyAuthentication({ ...base, expectedOrigin: "https://evil.example", credential: phone.authenticate("xyz", 1), expectedChallenge: "xyz", storedCounter: 0 })).toThrow(/unexpected site/);
    expect(() => verifyAuthentication({ ...base, credential: phone.authenticate("xyz", 5), expectedChallenge: "xyz", storedCounter: 5 })).toThrow(/cloned/);
    expect(() => verifyAuthentication({ ...base, credential: phone.authenticate("xyz", 1, 0x01), expectedChallenge: "xyz", storedCounter: 0 })).toThrow(/Fingerprint/);
  });

  it("rejects a signature made by a different key", () => {
    const owner = fakePhone();
    const thief = fakePhone();
    const registered = verifyRegistration({ credential: owner.register("abc"), expectedChallenge: "abc", expectedOrigin: origin, rpId });
    expect(() => verifyAuthentication({ credential: thief.authenticate("xyz", 1), expectedChallenge: "xyz", expectedOrigin: origin, rpId, publicKey: registered.publicKey, storedCounter: 0 })).toThrow(/signature/);
  });
});
