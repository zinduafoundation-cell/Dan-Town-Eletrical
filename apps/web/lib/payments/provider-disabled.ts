import { NextResponse } from "next/server";

export function retiredPaymentProviderResponse() {
  return NextResponse.json(
    { error: "This payment route has been retired. Pesapal is the only active payment provider." },
    { status: 410 },
  );
}
