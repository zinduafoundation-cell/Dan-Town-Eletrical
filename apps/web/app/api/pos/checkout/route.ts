import { retiredPaymentProviderResponse } from "@/lib/payments/provider-disabled";

export async function POST() {
  return retiredPaymentProviderResponse();
}
