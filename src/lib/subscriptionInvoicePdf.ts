import jsPDF from 'jspdf';
import { format } from 'date-fns';

export interface SubscriptionInvoiceData {
  payment: {
    id: string;
    plan: string;
    billing_cycle: string;
    amount: number;
    currency: string;
    transaction_id: string;
    sender_number: string;
    reference_code: string | null;
    payment_method: string;
    status: string;
    created_at: string;
    reviewed_at?: string | null;
    period_start?: string | null;
    period_end?: string | null;
  };
  restaurant: {
    name: string;
    slug: string;
    custom_domain?: string | null;
  };
  platform?: {
    name?: string;
    supportEmail?: string;
    /** Public URL of the platform logo to render in the invoice header. */
    logoUrl?: string | null;
    /** Optional accent colour as `[r, g, b]` (0-255). Defaults to a warm gold. */
    accentRgb?: [number, number, number];
  };
}

/** Fetch a logo URL and return a data-URL + jsPDF image format string, or null on failure. */
async function loadLogoForPdf(
  url: string,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' | 'WEBP'; width: number; height: number } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type.toLowerCase();
    // jsPDF only natively understands PNG, JPEG and WEBP. SVG is not supported — skip silently.
    let format: 'PNG' | 'JPEG' | 'WEBP';
    if (mime.includes('png')) format = 'PNG';
    else if (mime.includes('jpeg') || mime.includes('jpg')) format = 'JPEG';
    else if (mime.includes('webp')) format = 'WEBP';
    else return null;

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    // Read intrinsic dimensions so we can preserve the logo's aspect ratio in the PDF.
    const dims: { width: number; height: number } = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
      img.onerror = () => reject(new Error('logo decode failed'));
      img.src = dataUrl;
    });

    return { dataUrl, format, width: dims.width, height: dims.height };
  } catch (err) {
    console.warn('[invoice-pdf] failed to load logo', err);
    return null;
  }
}

/** Generates a clean A4 invoice/receipt PDF for an approved subscription payment. */
export async function generateSubscriptionInvoicePdf(data: SubscriptionInvoiceData): Promise<jsPDF> {
  const { payment, restaurant, platform } = data;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  const platformName = (platform?.name?.trim()) || 'ServeOS';
  const supportEmail = platform?.supportEmail?.trim() || '';
  const accent = platform?.accentRgb ?? [217, 162, 50]; // warm editorial gold
  const ink = [15, 23, 42] as const;       // slate-900
  const subInk = [71, 85, 105] as const;   // slate-600
  const muted = [100, 116, 139] as const;  // slate-500
  const hairline = [226, 232, 240] as const; // slate-200

  // Try to load the platform logo before painting the header so layout reacts to its presence.
  const logo = platform?.logoUrl ? await loadLogoForPdf(platform.logoUrl) : null;

  // ---- Light header (no full dark band) ----
  // Thin accent bar at the very top
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, 0, pageW, 4, 'F');

  // ---- Brand block (logo only; falls back to wordmark if logo unavailable) ----
  const brandBaselineY = 48;
  let logoRendered = false;
  if (logo) {
    // Cap the logo to a 48pt-tall band; scale width to keep the original aspect ratio.
    const targetH = 48;
    const targetW = Math.min(180, (logo.width / logo.height) * targetH);
    const logoY = brandBaselineY - targetH + 12;
    try {
      doc.addImage(logo.dataUrl, logo.format, margin, logoY, targetW, targetH, undefined, 'FAST');
      logoRendered = true;
    } catch (err) {
      console.warn('[invoice-pdf] addImage failed, falling back to wordmark', err);
    }
  }

  if (!logoRendered) {
    // Fallback wordmark only when no logo could be rendered.
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(platformName, margin, brandBaselineY);
  }

  // INVOICE label, right aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text('INVOICE', pageW - margin, 50, { align: 'right' });

  // Meta lines under INVOICE label
  doc.setFontSize(9);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text(`No. ${payment.id.slice(0, 8).toUpperCase()}`, pageW - margin, 64, { align: 'right' });
  doc.text(
    `Issued ${format(new Date(payment.reviewed_at || payment.created_at), 'MMM d, yyyy')}`,
    pageW - margin,
    78,
    { align: 'right' },
  );

  // Status pill — sits below the meta on the right, never collides with the wordmark
  const statusLabel = payment.status === 'approved' ? 'PAID' : payment.status.toUpperCase();
  const isPaid = payment.status === 'approved';
  const pillW = 60;
  const pillH = 18;
  const pillX = pageW - margin - pillW;
  const pillY = 90;
  doc.setFillColor(isPaid ? 16 : 234, isPaid ? 185 : 179, isPaid ? 129 : 8);
  doc.roundedRect(pillX, pillY, pillW, pillH, 9, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(statusLabel, pillX + pillW / 2, pillY + 12, { align: 'center' });

  // Hairline divider beneath the header
  doc.setDrawColor(hairline[0], hairline[1], hairline[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, 122, pageW - margin, 122);

  // ---- Bill To ----
  let y = 156;
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BILL TO', margin, y);
  doc.text('PAYMENT METHOD', pageW / 2, y);

  y += 16;
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.setFontSize(11);
  doc.text(restaurant.name, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(subInk[0], subInk[1], subInk[2]);
  // Show the verified custom domain if present, otherwise the restaurant slug — no platform host leakage.
  const domainLine = restaurant.custom_domain || `/${restaurant.slug}`;
  doc.text(domainLine, margin, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(ink[0], ink[1], ink[2]);
  doc.text(formatPaymentMethod(payment.payment_method), pageW / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(subInk[0], subInk[1], subInk[2]);
  doc.text(`From: ${payment.sender_number}`, pageW / 2, y + 14);

  // ---- Line item table ----
  y += 60;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('DESCRIPTION', margin, y);
  doc.text('PERIOD', pageW - margin - 200, y);
  doc.text('AMOUNT', pageW - margin, y, { align: 'right' });

  y += 10;
  doc.line(margin, y, pageW - margin, y);

  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const planLabel = `${capitalize(payment.plan)} Plan — ${capitalize(payment.billing_cycle)}`;
  doc.text(planLabel, margin, y);

  const periodText = payment.period_start && payment.period_end
    ? `${format(new Date(payment.period_start), 'MMM d, yyyy')} - ${format(new Date(payment.period_end), 'MMM d, yyyy')}`
    : payment.billing_cycle === 'yearly' ? '12 months' : '1 month';
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(periodText, pageW - margin - 200, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(payment.amount, payment.currency), pageW - margin, y, { align: 'right' });

  // ---- Totals ----
  y += 30;
  doc.line(margin, y, pageW - margin, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal', pageW - margin - 200, y);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(payment.amount, payment.currency), pageW - margin, y, { align: 'right' });

  y += 18;
  doc.setTextColor(71, 85, 105);
  doc.text('Tax', pageW - margin - 200, y);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(0, payment.currency), pageW - margin, y, { align: 'right' });

  y += 24;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1);
  doc.line(pageW - margin - 200, y - 12, pageW - margin, y - 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Total Paid', pageW - margin - 200, y);
  doc.text(formatMoney(payment.amount, payment.currency), pageW - margin, y, { align: 'right' });

  // ---- Payment details box ----
  y += 40;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageW - margin * 2, 90, 6, 6, 'F');
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PAYMENT DETAILS', margin + 16, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const details: Array<[string, string]> = [
    ['Transaction ID', payment.transaction_id],
    ['Reference', payment.reference_code || '—'],
    ['Submitted', format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')],
    ['Approved', payment.reviewed_at ? format(new Date(payment.reviewed_at), 'MMM d, yyyy HH:mm') : '—'],
  ];
  details.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + 16 + col * ((pageW - margin * 2 - 32) / 2);
    const ry = y + 42 + row * 22;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(k, x, ry);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(v, x, ry + 12);
  });

  // ---- Footer ----
  const footerY = doc.internal.pageSize.getHeight() - 50;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text('Thank you for your business.', margin, footerY + 18);
  if (supportEmail) {
    doc.text(`Questions? Contact ${supportEmail}`, margin, footerY + 32);
  }
  doc.text(
    `Generated ${format(new Date(), 'MMM d, yyyy HH:mm')}`,
    pageW - margin,
    footerY + 18,
    { align: 'right' },
  );

  return doc;
}

export async function downloadSubscriptionInvoice(data: SubscriptionInvoiceData) {
  const doc = await generateSubscriptionInvoicePdf(data);
  const fname = `invoice-${data.restaurant.slug}-${data.payment.id.slice(0, 8)}.pdf`;
  doc.save(fname);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMoney(amount: number, currency: string) {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPaymentMethod(method: string): string {
  switch (method) {
    case 'bkash': return 'bKash';
    case 'nagad': return 'Nagad';
    case 'rocket': return 'Rocket';
    default: return method.charAt(0).toUpperCase() + method.slice(1);
  }
}
