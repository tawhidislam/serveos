import { useCallback } from 'react';
import { format } from 'date-fns';

interface TicketItem {
  name: string;
  quantity: number;
  notes: string | null;
  selected_tags: string[];
  prep_time_minutes: number | null;
}

interface TicketOrder {
  id: string;
  ticket_number?: number | null;
  table_label?: string;
  status: string;
  created_at: string;
  notes: string | null;
  items: TicketItem[];
  estimated_prep_minutes: number | null;
}

function generateTicketHTML(order: TicketOrder, restaurantName?: string): string {
  const ticketNum = order.ticket_number ?? '—';
  const tableLabel = order.table_label ?? 'Takeaway';
  const time = format(new Date(order.created_at), 'HH:mm');
  const date = format(new Date(order.created_at), 'dd/MM/yyyy');
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  const itemsHTML = order.items
    .map(
      (item) => `
      <tr>
        <td style="font-size:16px;font-weight:bold;padding:4px 0;vertical-align:top;width:30px;">${item.quantity}×</td>
        <td style="font-size:15px;padding:4px 0;vertical-align:top;">
          <div style="font-weight:600;">${item.name}</div>
          ${item.prep_time_minutes ? `<div style="font-size:11px;color:#888;">~${item.prep_time_minutes} min</div>` : ''}
          ${item.selected_tags.length > 0 ? `<div style="font-size:12px;color:#d97706;font-weight:600;margin-top:2px;">🏷 ${item.selected_tags.join(', ')}</div>` : ''}
          ${item.notes ? `<div style="font-size:12px;color:#d97706;margin-top:2px;">⚠ ${item.notes}</div>` : ''}
        </td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kitchen Ticket #${ticketNum}</title>
  <style>
    @media print {
      @page { margin: 4mm; size: 80mm auto; }
      body { width: 72mm; }
    }
    body {
      font-family: 'Courier New', monospace;
      margin: 0;
      padding: 8px;
      color: #000;
      background: #fff;
    }
    .ticket {
      max-width: 300px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .ticket-num {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: 2px;
      line-height: 1;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 4px 0;
      border-bottom: 1px dashed #ccc;
      margin-bottom: 8px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
    }
    .footer {
      border-top: 2px dashed #000;
      margin-top: 8px;
      padding-top: 6px;
      text-align: center;
      font-size: 11px;
      color: #666;
    }
    .order-notes {
      border: 1px solid #d97706;
      background: #fffbeb;
      padding: 6px;
      font-size: 12px;
      color: #92400e;
      margin-top: 8px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      ${restaurantName ? `<div style="font-size:13px;font-weight:bold;margin-bottom:4px;">${restaurantName}</div>` : ''}
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:2px;">Kitchen Ticket</div>
      <div class="ticket-num">#${ticketNum}</div>
    </div>
    <div class="meta">
      <span><strong>${tableLabel}</strong></span>
      <span>${time} · ${date}</span>
    </div>
    <div class="meta" style="border-bottom:none;margin-bottom:0;">
      <span>${totalQty} item${totalQty !== 1 ? 's' : ''}</span>
      ${order.estimated_prep_minutes ? `<span>Est: ~${order.estimated_prep_minutes} min</span>` : ''}
    </div>
    <table class="items-table">
      <tbody>${itemsHTML}</tbody>
    </table>
    ${order.notes ? `<div class="order-notes">📝 ${order.notes}</div>` : ''}
    <div class="footer">
      Order ID: ${order.id.slice(0, 8)}<br/>
      Printed at ${format(new Date(), 'HH:mm:ss')}
    </div>
  </div>
</body>
</html>`;
}

export function usePrintTicket(restaurantName?: string) {
  const printTicket = useCallback(
    (order: TicketOrder) => {
      const html = generateTicketHTML(order, restaurantName);
      const printWindow = window.open('', '_blank', 'width=350,height=600');
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
      };
    },
    [restaurantName]
  );

  return { printTicket };
}

export type { TicketOrder, TicketItem };
