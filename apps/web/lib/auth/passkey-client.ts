"use client";

/** Browser helpers for fingerprint / face / screen-lock (WebAuthn). */

type Mode = "register" | "login" | "verify";

function toBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function toBase64Url(buffer: ArrayBuffer) {
  let binary = "";
  new Uint8Array(buffer).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function isBiometricAvailable() {
  if (typeof window === "undefined" || !window.PublicKeyCredential || !window.isSecureContext) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

type ServerOptions = {
  challenge: string;
  rpId?: string;
  rp?: { id: string; name: string };
  user?: { id: string; name: string; displayName: string };
  pubKeyCredParams?: PublicKeyCredentialParameters[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  excludeCredentials?: Array<{ type: "public-key"; id: string; transports?: AuthenticatorTransport[] }>;
  allowCredentials?: Array<{ type: "public-key"; id: string; transports?: AuthenticatorTransport[] }>;
};

export async function readPasskeyResponse<T>(response: Response): Promise<T> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    if (response.status === 404) {
      throw new Error("This app version does not have the biometric sign-in service. Refresh the page or ask an administrator to update the deployment.");
    }
    throw new Error("The biometric sign-in service returned an invalid response. Please try again later.");
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("The biometric sign-in service returned invalid data. Please try again.");
  }
}

async function fetchOptions(mode: Mode) {
  const response = await fetch("/api/auth/passkey/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
  const result = await readPasskeyResponse<{ publicKey?: ServerOptions; error?: string; code?: string }>(response);
  if (!response.ok || !result.publicKey) throw Object.assign(new Error(result.error || "Biometrics are unavailable right now."), { code: result.code });
  return result.publicKey;
}

async function submit(mode: Mode, credential: unknown, deviceLabel?: string) {
  const response = await fetch("/api/auth/passkey/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, credential, deviceLabel }) });
  const result = await readPasskeyResponse<{ ok?: boolean; error?: string }>(response);
  if (!response.ok || !result.ok) throw new Error(result.error || "Biometric check failed.");
}

function friendly(error: unknown): Error {
  if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) return new Error("Cancelled. Touch the fingerprint sensor or look at the phone when asked.");
  if (error instanceof DOMException && error.name === "InvalidStateError") return new Error("This phone is already linked to your account.");
  return error instanceof Error ? error : new Error("Biometric check failed.");
}

/** Link this phone to the signed-in staff member. */
export async function registerBiometric(deviceLabel: string) {
  try {
    const options = await fetchOptions("register");
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: toBuffer(options.challenge),
        rp: options.rp!,
        user: { id: toBuffer(options.user!.id), name: options.user!.name, displayName: options.user!.displayName },
        pubKeyCredParams: options.pubKeyCredParams!,
        authenticatorSelection: options.authenticatorSelection,
        attestation: options.attestation,
        timeout: options.timeout,
        excludeCredentials: (options.excludeCredentials ?? []).map((item) => ({ ...item, id: toBuffer(item.id) })),
      },
    })) as PublicKeyCredential | null;
    if (!credential) throw new Error("No biometric was created.");
    const attestation = credential.response as AuthenticatorAttestationResponse;
    await submit("register", {
      id: credential.id,
      response: {
        clientDataJSON: toBase64Url(attestation.clientDataJSON),
        attestationObject: toBase64Url(attestation.attestationObject),
        transports: typeof attestation.getTransports === "function" ? attestation.getTransports() : [],
      },
    }, deviceLabel);
  } catch (error) {
    throw friendly(error);
  }
}

async function authenticate(mode: "login" | "verify") {
  try {
    const options = await fetchOptions(mode);
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: toBuffer(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification: options.userVerification,
        allowCredentials: (options.allowCredentials ?? []).map((item) => ({ ...item, id: toBuffer(item.id) })),
      },
    })) as PublicKeyCredential | null;
    if (!credential) throw new Error("No biometric was provided.");
    const assertion = credential.response as AuthenticatorAssertionResponse;
    await submit(mode, {
      id: credential.id,
      response: {
        clientDataJSON: toBase64Url(assertion.clientDataJSON),
        authenticatorData: toBase64Url(assertion.authenticatorData),
        signature: toBase64Url(assertion.signature),
        userHandle: assertion.userHandle ? toBase64Url(assertion.userHandle) : null,
      },
    });
  } catch (error) {
    throw friendly(error);
  }
}

/** Sign in with no password: fingerprint/face picks the staff member. */
export const signInWithBiometric = () => authenticate("login");

/** Confirm "it is really me" for an already signed-in staff member (lasts a few minutes). */
export const confirmWithBiometric = () => authenticate("verify");

/**
 * fetch() that handles the "confirm with fingerprint" step automatically:
 * if the server asks for it, the phone prompts once and the request is retried.
 */
export async function fetchWithBiometric(input: RequestInfo | URL, init?: RequestInit) {
  const first = await fetch(input, init);
  if (first.status !== 403) return first;
  const body = (await first.clone().json().catch(() => null)) as { code?: string } | null;
  if (body?.code !== "BIOMETRIC_REQUIRED") return first;
  await confirmWithBiometric();
  return fetch(input, init);
}
