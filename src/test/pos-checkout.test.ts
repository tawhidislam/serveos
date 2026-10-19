import { describe, expect, it } from 'vitest';
import { escapeReceiptText, posCheckoutResultSchema, posInvoice, readPaymentAllocations, splitPaymentAmounts } from '@/lib/pos-checkout';

describe('POS financial records', () => {
  it('balances all split payments exactly, including indivisible cents', () => {
    expect(splitPaymentAmounts(100.01, 2)).toEqual([50, 50.01]);
    expect(splitPaymentAmounts(10, 3)).toEqual([3.33, 3.33, 3.34]);
    expect(() => splitPaymentAmounts(10, 0)).toThrow();
    expect(() => splitPaymentAmounts(-1, 2)).toThrow();
    expect(() => splitPaymentAmounts(Infinity, 2)).toThrow();
  });

  it('builds receipts from saved server amounts and line-price snapshots', () => {
    const result = posCheckoutResultSchema.parse({
      order: { id: 'dc596e09-7d1f-4313-9ce4-50bf94beecae', created_at: '2026-10-16T00:00:00Z', paid_at: '2026-10-16T00:00:00Z', payment_method: 'split', tax_rate: '7.5', discount_amount: '10', total_amount: '97.5', payment_splits: [{ method: 'cash', amount: 50 }, { method: 'card', amount: 47.5 }] },
      items: [{ name: 'Saved meal', quantity: 1, unit_price: '100', notes: 'No onions' }],
    });
    const invoice = posInvoice(result, 'T1');
    expect(invoice).toMatchObject({ subtotal: 100, taxAmount: 7.5, discountAmount: 10, grandTotal: 97.5, tableLabel: 'T1' });
    expect(invoice.items[0].unitPrice).toBe(100);
    expect(invoice.paymentSplits).toEqual([{ method: 'cash', amount: 50 }, { method: 'card', amount: 47.5 }]);
  });

  it('does not reinterpret legacy or malformed payments as valid allocations', () => {
    expect(readPaymentAllocations(undefined)).toEqual([]);
    expect(readPaymentAllocations([{ method: 'cash', amount: -10 }])).toEqual([]);
    expect(readPaymentAllocations([{ method: 'pay_later', amount: 10 }])).toEqual([]);
    expect(readPaymentAllocations([{ method: 'mobile', amount: 10 }])).toEqual([{ method: 'mobile', amount: 10 }]);
  });

  it('prints names and notes as text rather than executable markup', () => {
    expect(escapeReceiptText('<img src=x onerror="alert(1)"> & spicy')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; spicy');
  });
});
