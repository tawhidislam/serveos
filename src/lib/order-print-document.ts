/**
 * Combined order print document builder.
 *
 * Produces ONE printable HTML document containing:
 *   Page 1 — Kitchen ticket (80mm thermal style, no prices)
 *   Page 2 — Customer invoice receipt (with prices, tax, totals)
 *
 * Markup is adapted from the two existing, production-tested templates:
 *   - Kitchen ticket: `src/components/kitchen/KitchenTicketPrint.tsx`
 *   - Invoice receipt: `src/pages/POSPage.tsx` (`triggerPrintFromData`)
 * Keeping the visual language identical means staff see the same layout
 * whether printing manually from POS/KDS or via global auto-print.
 */
import { format } from 'date-fns';

/* ── types ─────────────────────────────────────────── */

export interface OrderPrintItem {
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  selectedTags?: string[];
  prepTimeMinutes?: number | null;
}

export interface OrderPrintOrder {
  id: string;
  ticketNumber?: number | null;
  tableLabel?: string | null;
  orderType?: string | null;
  status: string;
  createdAt: string;
  notes?: string | null;
  items: OrderPrintItem[];
  /** Invoice fields */
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  paidAt?: string | null;
  paymentMethod?: string | null;
}

/* ── helpers ───────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── kitchen ticket section ────────────────────────── */

function buildKitchenTicketSection(order: OrderPrintOrder, restaurantName: string): string {
  const ticketNum = order.ticketNumber ?? '—';
  const tableLabel = order.tableLabel ?? 'Takeaway';
  const time = format(new Date(order.createdAt), 'HH:mm');
  const date = format(new Date(order.createdAt), 'dd/MM/yyyy');
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const prepTimes = order.items
    .map((i) => i.prepTimeMinutes)
    .filter((t): t is number => t != null);
  const estimatedPrep = prepTimes.length > 0 ? Math.max(...prepTimes) : null;

  const itemsHTML = order.items
    .map(
      (item) => `
      <tr>
        <td style="font-size:16px;font-weight:bold;padding:4px 0;vertical-align:top;width:30px;">${item.quantity}×</td>
        <td style="font-size:15px;padding:4px 0;vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(item.name)}</div>
          ${item.prepTimeMinutes ? `<div style="font-size:11px;color:#888;">~${item.prepTimeMinutes} min</div>` : ''}
          ${item.selectedTags && item.selectedTags.length > 0 ? `<div style="font-size:12px;color:#d97706;font-weight:600;margin-top:2px;">🏷 ${item.selectedTags.map(escapeHtml).join(', ')}</div>` : ''}
          ${item.notes ? `<div style="font-size:12px;color:#d97706;margin-top:2px;">⚠ ${escapeHtml(item.notes)}</div>` : ''}
        </td>
      </tr>`
    )
    .join('');

  return `
  <div class="ticket">
    <div class="header">
      <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">${escapeHtml(restaurantName)}</div>
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:2px;">Kitchen Ticket</div>
      <div class="ticket-num">#${ticketNum}</div>
    </div>
    <div class="meta">
      <span><strong>${escapeHtml(tableLabel)}</strong></span>
      <span>${time} · ${date}</span>
    </div>
    <div class="meta" style="border-bottom:none;margin-bottom:0;">
      <span>${totalQty} item${totalQty !== 1 ? 's' : ''}</span>
      ${estimatedPrep ? `<span>Est: ~${estimatedPrep} min</span>` : ''}
    </div>
    <table class="items-table">
      <tbody>${itemsHTML}</tbody>
    </table>
    ${order.notes ? `<div class="order-notes">📝 ${escapeHtml(order.notes)}</div>` : ''}
    <div class="footer">
      Order ID: ${order.id.slice(0, 8)}<br/>
      Printed at ${format(new Date(), 'HH:mm:ss')}
    </div>
  </div>`;
}

/* ── invoice receipt section ───────────────────────── */

function buildInvoiceSection(
  order: OrderPrintOrder,
  restaurantName: string,
  fmt: (n: number) => string
): string {
  const invNum = `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const orderDate = format(new Date(order.createdAt), 'MMM d, yyyy');
  const orderTime = format(new Date(order.createdAt), 'h:mm a');

  const itemsHTML = order.items
    .map(
      (item) => `
      <div class="row"><span>${item.quantity}× ${escapeHtml(item.name)}</span><span>${fmt(item.unitPrice * item.quantity)}</span></div>
      ${item.notes ? `<div class="notes">⚠ ${escapeHtml(item.notes)}</div>` : ''}`
    )
    .join('');

  return `
  <div class="invoice">
    <div class="header">
      <h1>${escapeHtml(restaurantName)}</h1>
      <p>${invNum}</p>
      <p>${orderDate} · ${orderTime}</p>
      ${order.tableLabel ? `<p>Table: ${escapeHtml(order.tableLabel)}</p>` : ''}
    </div>
    <hr class="divider"/>
    ${itemsHTML}
    <hr class="divider"/>
    <div class="row light"><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>
    <div class="row light"><span>Tax (${order.taxRate}%)</span><span>+${fmt(order.taxAmount)}</span></div>
    ${order.discountAmount > 0 ? `<div class="row red"><span>Discount</span><span>-${fmt(order.discountAmount)}</span></div>` : ''}
    <hr class="divider"/>
    <div class="row total"><span>TOTAL</span><span>${fmt(order.grandTotal)}</span></div>
    ${order.paymentMethod ? `<div class="row light"><span>Paid via</span><span style="text-transform:capitalize">${escapeHtml(order.paymentMethod)}</span></div>` : ''}
    <hr class="divider"/>
    <div class="footer">
      <p>Thank you for dining with us!</p>
      <p>#${order.id.slice(0, 8)}</p>
    </div>
  </div>`;
}

/* ── combined document ─────────────────────────────── */

/**
 * Build the combined kitchen-ticket + invoice-receipt print document.
 *
 * @param order      Order data with items and invoice totals pre-computed.
 * @param restaurantName  Header name for both sections.
 * @param fmt        Currency formatter, e.g. from `useCurrency().format`.
 */
export function buildOrderPrintDocument(
  order: OrderPrintOrder,
  restaurantName: string,
  fmt: (n: number) => string
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order ${order.id.slice(0, 8)}</title>
  <style>
    @media print {
      @page { margin: 4mm; size: 80mm auto; }
      body { width: 72mm; }
      .page-break { page-break-after: always; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      color: #000;
      background: #fff;
      padding: 8px;
    }
    .page-break { height: 0; }

    /* ── kitchen ticket ── */
    .ticket { max-width: 300px; margin: 0 auto; }
    .ticket .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
    .ticket .ticket-num { font-size: 36px; font-weight: 900; letter-spacing: 2px; line-height: 1; }
    .ticket .meta { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px dashed #ccc; margin-bottom: 8px; }
    .ticket .items-table { width: 100%; border-collapse: collapse; }
    .ticket .footer { border-top: 2px dashed #000; margin-top: 8px; padding-top: 6px; text-align: center; font-size: 11px; color: #666; }
    .ticket .order-notes { border: 1px solid #d97706; background: #fffbeb; padding: 6px; font-size: 12px; color: #92400e; margin-top: 8px; border-radius: 4px; }

    /* ── invoice receipt ── */
    .invoice { max-width: 320px; margin: 0 auto; font-size: 12px; }
    .invoice .header { text-align: center; margin-bottom: 8px; }
    .invoice .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    .invoice .header p { font-size: 10px; color: #666; margin-bottom: 2px; }
    .divider { border: none; border-top: 1px dashed #333; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
    .row.light { color: #666; font-size: 11px; }
    .row.red { color: #c00; }
    .row.total { font-size: 16px; font-weight: bold; padding: 6px 0; }
    .notes { font-size: 10px; color: #888; padding-left: 16px; padding-bottom: 2px; }
    .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #888; }
    .footer p { margin-bottom: 2px; }
  </style>
</head>
<body>
  ${buildKitchenTicketSection(order, restaurantName)}
  <div class="page-break"></div>
  ${buildInvoiceSection(order, restaurantName, fmt)}
</body>
</html>`;
}
