import { z } from 'zod';
import type { InvoiceData } from '@/components/InvoiceReceipt';

export type TenderMethod = 'cash' | 'card' | 'mobile';
export interface PaymentAllocation { method: TenderMethod; amount: number }
const money = z.coerce.number().finite().nonnegative();
const allocation = z.object({ method: z.enum(['cash', 'card', 'mobile']), amount: money });
export function readPaymentAllocations(value: unknown): PaymentAllocation[] {
  const parsed = z.array(allocation).safeParse(value);
  return parsed.success ? parsed.data.map(part => ({ method: part.method!, amount: part.amount! })) : [];
}
export const posCheckoutResultSchema = z.object({
  order: z.object({
    id: z.string().uuid(), created_at: z.string(), paid_at: z.string().nullable(),
    payment_method: z.string().nullable(), tax_rate: money, discount_amount: money,
    total_amount: money, payment_splits: z.array(allocation).default([]),
  }).passthrough(),
  items: z.array(z.object({ name: z.string(), quantity: z.number().int().positive(), unit_price: money, notes: z.string().nullable() })),
});

export function posInvoice(result: z.infer<typeof posCheckoutResultSchema>, tableLabel?: string | null): InvoiceData {
  const subtotal = result.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  return {
    orderId: result.order.id, tableLabel, createdAt: result.order.created_at, paidAt: result.order.paid_at,
    paymentMethod: result.order.payment_method, paymentSplits: result.order.payment_splits.map(part => ({ method: part.method!, amount: part.amount! })),
    items: result.items.map(item => ({ name: item.name, quantity: item.quantity, unitPrice: item.unit_price, notes: item.notes })),
    subtotal, taxRate: result.order.tax_rate, taxAmount: Math.round(subtotal * result.order.tax_rate) / 100,
    discountAmount: result.order.discount_amount, grandTotal: result.order.total_amount,
  };
}

/** Allocate whole cents; the final portion receives the rounding remainder. */
export function splitPaymentAmounts(total: number, count: number) {
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(count) || count < 2 || count > 20) throw new Error('Invalid split amount or count');
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, index) => (base + (index === count - 1 ? cents % count : 0)) / 100);
}

export function escapeReceiptText(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
