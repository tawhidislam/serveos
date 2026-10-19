import { useRef } from 'react';
import { format } from 'date-fns';
import { useCurrency } from '@/lib/currency';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Printer, FileText, Download } from 'lucide-react';
import { escapeReceiptText, type PaymentAllocation } from '@/lib/pos-checkout';

export type InvoiceItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
};

export type InvoiceData = {
  orderId: string;
  tableLabel?: string | null;
  createdAt: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  paymentSplits?: PaymentAllocation[];
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: InvoiceData | null;
}

export default function InvoiceReceipt({ open, onOpenChange, data }: Props) {
  const { format: fmt } = useCurrency();
  const { data: settings } = useSettings();

  if (!data) return null;

  const restaurantName = settings?.restaurant_name ?? 'Restaurant';
  const invoiceNumber = `INV-${data.orderId.slice(0, 8).toUpperCase()}`;
  const orderDate = format(new Date(data.createdAt), 'MMM d, yyyy');
  const orderTime = format(new Date(data.createdAt), 'h:mm a');

  const buildPrintHTML = () => {
    const itemsHTML = data.items.map(item => `
      <div class="row">
        <span>${item.quantity}× ${escapeReceiptText(item.name)}</span>
        <span>${fmt(item.unitPrice * item.quantity)}</span>
      </div>
      ${item.notes ? `<div class="notes">⚠ ${escapeReceiptText(item.notes)}</div>` : ''}
    `).join('');

    const discountHTML = data.discountAmount > 0 ? `
      <div class="row red">
        <span>Discount</span>
        <span>-${fmt(data.discountAmount)}</span>
      </div>
    ` : '';

    const paymentHTML = data.paymentMethod ? `
      <div class="row light">
        <span>Paid via</span>
        <span style="text-transform:capitalize">${escapeReceiptText(data.paymentMethod)}</span>
      </div>
    ` : '';

    const paidAtHTML = data.paidAt ? `
      <div class="row light">
        <span>Paid at</span>
        <span>${format(new Date(data.paidAt), 'h:mm a')}</span>
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <title>${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; padding: 20px; max-width: 320px; margin: 0 auto; color: #000; background: #fff; }
    .header { text-align: center; margin-bottom: 8px; }
    .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    .header p { font-size: 10px; color: #666; margin-bottom: 2px; }
    .divider { border: none; border-top: 1px dashed #333; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
    .row.light { color: #666; font-size: 11px; }
    .row.red { color: #c00; }
    .row.total { font-size: 16px; font-weight: bold; padding: 6px 0; }
    .notes { font-size: 10px; color: #888; padding-left: 16px; padding-bottom: 2px; }
    .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #888; }
    .footer p { margin-bottom: 2px; }
    @media print {
      body { padding: 8px; }
      @page { margin: 10mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeReceiptText(restaurantName)}</h1>
    <p>${invoiceNumber}</p>
    <p>${orderDate} · ${orderTime}</p>
    ${data.tableLabel ? `<p>Table: ${escapeReceiptText(data.tableLabel)}</p>` : ''}
  </div>

  <hr class="divider" />

  ${itemsHTML}

  <hr class="divider" />

  <div class="row light">
    <span>Subtotal</span>
    <span>${fmt(data.subtotal)}</span>
  </div>
  <div class="row light">
    <span>Tax (${data.taxRate}%)</span>
    <span>+${fmt(data.taxAmount)}</span>
  </div>
  ${discountHTML}

  <hr class="divider" />

  <div class="row total">
    <span>TOTAL</span>
    <span>${fmt(data.grandTotal)}</span>
  </div>

  ${paymentHTML}
  ${(data.paymentSplits?.length ?? 0) > 1 ? data.paymentSplits!.map((part, index) => `<div class="row light"><span>Split ${index + 1} (${escapeReceiptText(part.method)})</span><span>${fmt(part.amount)}</span></div>`).join('') : ''}
  ${paidAtHTML}

  <hr class="divider" />

  <div class="footer">
    <p>Thank you for dining with us!</p>
    <p>#${data.orderId.slice(0, 8)}</p>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const html = buildPrintHTML();
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) {
      // Fallback: create iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      document.body.appendChild(iframe);
      iframe.contentDocument?.write(html);
      iframe.contentDocument?.close();
      setTimeout(() => {
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 300);
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleDownloadPDF = () => {
    const html = buildPrintHTML();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '400px';
    iframe.style.height = '700px';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }
    
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        // Fallback
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoiceNumber}.html`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" strokeWidth={1.5} />
            Invoice / Receipt
          </DialogTitle>
          <DialogDescription>{invoiceNumber}</DialogDescription>
        </DialogHeader>

        {/* Receipt preview */}
        <div className="bg-white text-black border border-border rounded-lg p-4 font-mono text-xs space-y-2">
          {/* Header */}
          <div className="text-center">
            <div className="text-base font-bold">{restaurantName}</div>
            <div className="text-[10px] text-gray-500">{invoiceNumber}</div>
            <div className="text-[10px] text-gray-500">{orderDate} · {orderTime}</div>
            {data.tableLabel && (
              <div className="text-[10px] text-gray-500">Table: {data.tableLabel}</div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-300" />

          {/* Items */}
          <div className="space-y-1">
            {data.items.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span>{item.quantity}× {item.name}</span>
                  <span className="tabular-nums">{fmt(item.unitPrice * item.quantity)}</span>
                </div>
                {item.notes && (
                  <div className="text-[10px] text-gray-400 pl-2">⚠ {item.notes}</div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300" />

          {/* Totals */}
          <div className="space-y-0.5 text-gray-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(data.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({data.taxRate}%)</span>
              <span className="tabular-nums">+{fmt(data.taxAmount)}</span>
            </div>
            {data.discountAmount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount</span>
                <span className="tabular-nums">-{fmt(data.discountAmount)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-300" />

          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span className="tabular-nums">{fmt(data.grandTotal)}</span>
          </div>

          {data.paymentMethod && (
            <div className="flex justify-between text-gray-500">
              <span>Paid via</span>
              <span className="capitalize">{data.paymentMethod}</span>
            </div>
          )}
          {data.paidAt && (
            <>
              {(data.paymentSplits?.length ?? 0) > 1 && data.paymentSplits!.map((part, index) => <div key={index} className="flex justify-between text-gray-500"><span>Split {index + 1} ({part.method})</span><span>{fmt(part.amount)}</span></div>)}
            <div className="flex justify-between text-gray-500">
              <span>Paid at</span>
              <span>{format(new Date(data.paidAt), 'h:mm a')}</span>
            </div>
            </>
          )}

          <div className="border-t border-dashed border-gray-300" />

          <div className="text-center text-[10px] text-gray-400 pt-1">
            <p>Thank you for dining with us!</p>
            <p className="mt-0.5">#{data.orderId.slice(0, 8)}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </DialogClose>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPDF}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Save PDF
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
