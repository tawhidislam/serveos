interface PaymentSummary { status: string; amount: number; currency: string; created_at: string; reviewed_at?: string | null }
/** Collected payments, grouped by currency instead of combining unlike amounts. */
export function collectedThisMonth(payments: PaymentSummary[], now = new Date()): Record<string, number> {
  const month = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Shanghai' });
  const current = month.format(now);
  return payments.reduce<Record<string, number>>((totals, payment) => {
    const date = new Date(payment.reviewed_at || payment.created_at);
    if (payment.status === 'approved' && Number.isFinite(date.getTime()) && month.format(date) === current) {
      const amount = Number(payment.amount);
      if (Number.isFinite(amount)) totals[payment.currency] = (totals[payment.currency] ?? 0) + amount;
    }
    return totals;
  }, {});
}
