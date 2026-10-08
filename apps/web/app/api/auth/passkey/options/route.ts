import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { challengeCookie, isStaffUser, listPasskeys, maxDevicesPerPerson, newChallenge, relyingParty, tooManyAttempts } from "@/lib/auth/passkeys";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ mode: z.enum(["register", "login", "verify"]) });

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { mode } = body.data;
  const { rpId, rpName } = relyingParty(request);
  const challenge = newChallenge();

  if (mode === "login") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (tooManyAttempts(`login:${ip}`)) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const response = NextResponse.json({ publicKey: { challenge, rpId, timeout: 60000, userVerification: "required", allowCredentials: [] } });
    response.cookies.set(challengeCookie("login", challenge, null));
    return response;
  }

  const context = await getAuthorizationContext();
  if (!context || context.userId === "dev-bypass-user") return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isStaffUser(user.id, user.email))) return NextResponse.json({ error: "Biometrics are for Dantown staff accounts." }, { status: 403 });

  const existing = await listPasskeys(user.id);

  if (mode === "register") {
    if (existing.length >= maxDevicesPerPerson) return NextResponse.json({ error: `You can link up to ${maxDevicesPerPerson} devices. Remove one first.` }, { status: 400 });
    const response = NextResponse.json({
      publicKey: {
        challenge,
        rp: { id: rpId, name: rpName },
        user: { id: Buffer.from(user.id).toString("base64url"), name: user.email ?? user.id, displayName: user.email ?? "Dantown staff" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", requireResidentKey: true, userVerification: "required" },
        attestation: "none",
        timeout: 60000,
        excludeCredentials: existing.map((row) => ({ type: "public-key", id: row.credential_id, transports: row.transports })),
      },
    });
    response.cookies.set(challengeCookie("register", challenge, user.id));
    return response;
  }

  if (!existing.length) return NextResponse.json({ error: "No fingerprint or face is linked to this account yet.", code: "NO_PASSKEY" }, { status: 404 });
  const response = NextResponse.json({
    publicKey: {
      challenge,
      rpId,
      timeout: 60000,
      userVerification: "required",
      allowCredentials: existing.map((row) => ({ type: "public-key", id: row.credential_id, transports: row.transports })),
    },
  });
  response.cookies.set(challengeCookie("verify", challenge, user.id));
  return response;
}
