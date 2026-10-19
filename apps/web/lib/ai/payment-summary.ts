export type PaymentSummaryRecord = {
  amount: number | string;
  method: string;
  status: string;
};

export type RefundSummaryRecord = {
  amount: number | string;
  paymentId: string;
  status: string;
};

export function summarizePaymentRecords(
  records: PaymentSummaryRecord[],
  refunds: RefundSummaryRecord[] = [],
  refundMethods: Map<string, string> = new Map()
) {
  const successful = records.filter((payment) =>
    ["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status)
  );
  const pending = records.filter((payment) => payment.status === "PENDING");
  const verifiedRefunds = refunds.filter((refund) => refund.status === "SUCCESS");
  const verifiedReceivedAmount = successful.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const verifiedRefundedAmount = verifiedRefunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  return {
    scope: "Latest 100 payment records and latest 100 refund records in the period",
    truncated: records.length === 100 || refunds.length === 100,
    recordsReviewed: records.length,
    refundRecordsReviewed: refunds.length,
    verifiedReceivedAmount: Number(verifiedReceivedAmount.toFixed(2)),
    verifiedRefundedAmount: Number(verifiedRefundedAmount.toFixed(2)),
    netOfVerifiedRefunds: Number((verifiedReceivedAmount - verifiedRefundedAmount).toFixed(2)),
    verifiedReceivedCount: successful.length,
    verifiedRefundCount: verifiedRefunds.length,
    pendingAmount: Number(pending.reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(2)),
    pendingCount: pending.length,
    otherUnverifiedCount: records.filter((payment) =>
      !["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED", "PENDING"].includes(payment.status)
    ).length,
    methods: [...new Set([...records.map((payment) => payment.method), ...verifiedRefunds
      .map((refund) => refundMethods.get(refund.paymentId))
      .filter((method): method is string => method !== undefined)])].map((method) => ({
      method,
      verifiedReceivedAmount: Number(successful
        .filter((payment) => payment.method === method)
        .reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(2)),
      verifiedRefundedAmount: Number(verifiedRefunds
        .filter((refund) => refundMethods.get(refund.paymentId) === method)
        .reduce((sum, refund) => sum + Number(refund.amount), 0).toFixed(2))
    }))
  };
}
