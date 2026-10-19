import { NextResponse } from "next/server";
import { getPermissionGuard } from "@/lib/auth/server";
import { paymentProviderSettingsSchema } from "@/lib/payments/payment-provider-options";
import {
  loadPaymentProviderReadiness,
  loadPaymentProviderSettings,
  savePaymentProviderSettings,
} from "@/lib/payments/payment-provider-settings";

export async function GET() {
  const guard = await getPermissionGuard("settings.manage");
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  try {
    const { settings, updatedAt } = await loadPaymentProviderSettings();
    const readiness = await loadPaymentProviderReadiness(settings);
    return NextResponse.json({ settings, readiness, updatedAt });
  } catch (error) {
    console.error("Unable to load payment provider settings:", error);
    return NextResponse.json({ error: "Unable to load payment provider settings." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const guard = await getPermissionGuard("settings.manage");
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payment settings must be valid JSON." }, { status: 400 });
  }

  const parsed = paymentProviderSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Review the payment method settings and try again." }, { status: 400 });
  }

  try {
    const updatedAt = await savePaymentProviderSettings(
      parsed.data,
      guard.context.userId === "dev-bypass-user" ? null : guard.context.userId,
    );
    const readiness = await loadPaymentProviderReadiness(parsed.data);
    return NextResponse.json({ settings: parsed.data, readiness, updatedAt });
  } catch (error) {
    console.error("Unable to save payment provider settings:", error);
    return NextResponse.json({ error: "Unable to save payment provider settings." }, { status: 500 });
  }
}
