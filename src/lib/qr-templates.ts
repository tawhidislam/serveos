/**
 * QR Code branded frame templates.
 * Each template produces a complete SVG wrapper around a cloned QR SVG element.
 */

export type QRTemplateId = 'classic' | 'modern' | 'minimal' | 'elegant';

export interface QRTemplateColors {
  border?: string;
  accent?: string;
  text?: string;
  background?: string;
  qrBg?: string;
}

export interface QRTemplateMeta {
  id: QRTemplateId;
  name: string;
  description: string;
}

export const QR_TEMPLATES: QRTemplateMeta[] = [
  { id: 'classic', name: 'Classic', description: 'Double border with corner ornaments' },
  { id: 'modern', name: 'Modern', description: 'Clean gradient accent bar' },
  { id: 'minimal', name: 'Minimal', description: 'Simple thin border' },
  { id: 'elegant', name: 'Elegant', description: 'Ornate decorative flourishes' },
];

const svgNS = 'http://www.w3.org/2000/svg';

function el(tag: string, attrs: Record<string, string>): SVGElement {
  const e = document.createElementNS(svgNS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

function text(content: string, attrs: Record<string, string>): SVGTextElement {
  const t = document.createElementNS(svgNS, 'text') as SVGTextElement;
  Object.entries(attrs).forEach(([k, v]) => t.setAttribute(k, v));
  t.textContent = content;
  return t;
}

function cloneQR(qrSvg: SVGElement, size: number): SVGElement {
  const clone = qrSvg.cloneNode(true) as SVGElement;
  // Preserve the original viewBox if it exists, otherwise construct from width/height
  const existingViewBox = qrSvg.getAttribute('viewBox');
  const vb = existingViewBox || `0 0 ${qrSvg.getAttribute('width') || size} ${qrSvg.getAttribute('height') || size}`;
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));
  clone.setAttribute('viewBox', vb);
  // Remove any x/y offset that could misposition
  clone.removeAttribute('x');
  clone.removeAttribute('y');
  return clone;
}

function createRoot(w: number, h: number): SVGSVGElement {
  const root = document.createElementNS(svgNS, 'svg') as SVGSVGElement;
  root.setAttribute('xmlns', svgNS);
  root.setAttribute('width', String(w));
  root.setAttribute('height', String(h));
  root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  return root;
}

// ─── CLASSIC ──────────────────────────────────────────────
function buildClassic(
  qrSvg: SVGElement, tableLabel: string, restaurantName: string,
  tagline: string | null, colors: Required<QRTemplateColors>
): SVGSVGElement {
  const W = 480, H = 620, qrSize = 280;
  const qrX = (W - qrSize) / 2, qrY = 170;
  const root = createRoot(W, H);

  root.appendChild(el('rect', { width: String(W), height: String(H), rx: '24', fill: colors.background }));
  root.appendChild(el('rect', { x: '1.5', y: '1.5', width: String(W - 3), height: String(H - 3), rx: '24', fill: 'none', stroke: colors.border, 'stroke-width': '3' }));
  root.appendChild(el('rect', { x: '14', y: '14', width: String(W - 28), height: String(H - 28), rx: '18', fill: 'none', stroke: colors.accent, 'stroke-width': '1.5', 'stroke-dasharray': '6 4' }));

  // Corner diamonds
  [{ cx: 30, cy: 30 }, { cx: W - 30, cy: 30 }, { cx: 30, cy: H - 30 }, { cx: W - 30, cy: H - 30 }].forEach(({ cx, cy }) => {
    const s = 6;
    root.appendChild(el('path', { d: `M${cx} ${cy - s} L${cx + s} ${cy} L${cx} ${cy + s} L${cx - s} ${cy} Z`, fill: colors.accent }));
  });

  root.appendChild(el('line', { x1: '60', y1: '50', x2: String(W - 60), y2: '50', stroke: colors.accent, 'stroke-width': '1' }));
  root.appendChild(text(restaurantName.toUpperCase(), { x: String(W / 2), y: '85', 'text-anchor': 'middle', 'font-family': 'Outfit, Helvetica, sans-serif', 'font-weight': '700', 'font-size': '22', fill: colors.text, 'letter-spacing': '2' }));
  root.appendChild(text('SCAN TO ORDER', { x: String(W / 2), y: '112', 'text-anchor': 'middle', 'font-family': 'Plus Jakarta Sans, Helvetica, sans-serif', 'font-weight': '500', 'font-size': '13', fill: colors.accent, 'letter-spacing': '3' }));
  root.appendChild(el('line', { x1: String(W / 2 - 40), y1: '130', x2: String(W / 2 + 40), y2: '130', stroke: colors.border, 'stroke-width': '2' }));

  root.appendChild(el('rect', { x: String(qrX - 16), y: String(qrY - 16), width: String(qrSize + 32), height: String(qrSize + 32), rx: '12', fill: colors.qrBg, stroke: '#e2e8f0', 'stroke-width': '1' }));

  const g = el('g', { transform: `translate(${qrX}, ${qrY})` });
  g.appendChild(cloneQR(qrSvg, qrSize));
  root.appendChild(g);

  root.appendChild(text(tableLabel, { x: String(W / 2), y: String(qrY + qrSize + 50), 'text-anchor': 'middle', 'font-family': 'Outfit, Helvetica, sans-serif', 'font-weight': '700', 'font-size': '28', fill: colors.border }));
  root.appendChild(el('line', { x1: '60', y1: String(H - 50), x2: String(W - 60), y2: String(H - 50), stroke: colors.accent, 'stroke-width': '1' }));

  if (tagline) {
    root.appendChild(text(tagline, { x: String(W / 2), y: String(H - 28), 'text-anchor': 'middle', 'font-family': 'Plus Jakarta Sans, Helvetica, sans-serif', 'font-weight': '400', 'font-size': '11', fill: '#94a3b8' }));
  }

  return root;
}

// ─── MODERN ──────────────────────────────────────────────
function buildModern(
  qrSvg: SVGElement, tableLabel: string, restaurantName: string,
  tagline: string | null, colors: Required<QRTemplateColors>
): SVGSVGElement {
  const W = 440, H = 580, qrSize = 260;
  const qrX = (W - qrSize) / 2, qrY = 160;
  const root = createRoot(W, H);

  root.appendChild(el('rect', { width: String(W), height: String(H), rx: '20', fill: colors.background }));
  // Top accent bar
  root.appendChild(el('rect', { x: '0', y: '0', width: String(W), height: '6', rx: '3', fill: colors.border }));
  // Gradient stripe
  const defs = document.createElementNS(svgNS, 'defs');
  const grad = document.createElementNS(svgNS, 'linearGradient');
  grad.setAttribute('id', 'mod-grad');
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '1'); grad.setAttribute('y2', '0');
  const s1 = document.createElementNS(svgNS, 'stop');
  s1.setAttribute('offset', '0'); s1.setAttribute('stop-color', colors.border);
  const s2 = document.createElementNS(svgNS, 'stop');
  s2.setAttribute('offset', '1'); s2.setAttribute('stop-color', colors.accent);
  grad.appendChild(s1); grad.appendChild(s2);
  defs.appendChild(grad);
  root.appendChild(defs);

  root.appendChild(text(restaurantName.toUpperCase(), { x: String(W / 2), y: '50', 'text-anchor': 'middle', 'font-family': 'Outfit, Helvetica, sans-serif', 'font-weight': '800', 'font-size': '18', fill: colors.text, 'letter-spacing': '4' }));
  root.appendChild(el('rect', { x: String(W / 2 - 30), y: '62', width: '60', height: '2', rx: '1', fill: 'url(#mod-grad)' }));
  root.appendChild(text('Scan for Menu', { x: String(W / 2), y: '95', 'text-anchor': 'middle', 'font-family': 'Plus Jakarta Sans, Helvetica, sans-serif', 'font-weight': '400', 'font-size': '14', fill: '#64748b' }));

  // QR container with shadow-like border
  root.appendChild(el('rect', { x: String(qrX - 20), y: String(qrY - 20), width: String(qrSize + 40), height: String(qrSize + 40), rx: '16', fill: colors.qrBg, stroke: '#e2e8f0', 'stroke-width': '1.5' }));

  const g = el('g', { transform: `translate(${qrX}, ${qrY})` });
  g.appendChild(cloneQR(qrSvg, qrSize));
  root.appendChild(g);

  root.appendChild(text(tableLabel, { x: String(W / 2), y: String(qrY + qrSize + 55), 'text-anchor': 'middle', 'font-family': 'Outfit, Helvetica, sans-serif', 'font-weight': '700', 'font-size': '26', fill: colors.border }));

  if (tagline) {
    root.appendChild(text(tagline, { x: String(W / 2), y: String(H - 30), 'text-anchor': 'middle', 'font-family': 'Plus Jakarta Sans, sans-serif', 'font-weight': '400', 'font-size': '11', fill: '#94a3b8' }));
  }

  // Bottom accent bar
  root.appendChild(el('rect', { x: '0', y: String(H - 6), width: String(W), height: '6', rx: '3', fill: colors.border }));

  return root;
}

// ─── MINIMAL ──────────────────────────────────────────────
function buildMinimal(
  qrSvg: SVGElement, tableLabel: string, restaurantName: string,
  _tagline: string | null, colors: Required<QRTemplateColors>
): SVGSVGElement {
  const W = 380, H = 480, qrSize = 260;
  const qrX = (W - qrSize) / 2, qrY = 90;
  const root = createRoot(W, H);

  root.appendChild(el('rect', { width: String(W), height: String(H), rx: '12', fill: colors.background }));
  root.appendChild(el('rect', { x: '4', y: '4', width: String(W - 8), height: String(H - 8), rx: '10', fill: 'none', stroke: colors.border, 'stroke-width': '1' }));

  root.appendChild(text(restaurantName, { x: String(W / 2), y: '50', 'text-anchor': 'middle', 'font-family': 'Outfit, Helvetica, sans-serif', 'font-weight': '600', 'font-size': '16', fill: colors.text }));

  const g = el('g', { transform: `translate(${qrX}, ${qrY})` });
  g.appendChild(cloneQR(qrSvg, qrSize));
  root.appendChild(g);

  root.appendChild(text(tableLabel, { x: String(W / 2), y: String(qrY + qrSize + 40), 'text-anchor': 'middle', 'font-family': 'Outfit, Helvetica, sans-serif', 'font-weight': '700', 'font-size': '22', fill: colors.border }));
  root.appendChild(text('Scan to view menu', { x: String(W / 2), y: String(qrY + qrSize + 62), 'text-anchor': 'middle', 'font-family': 'Plus Jakarta Sans, sans-serif', 'font-weight': '400', 'font-size': '12', fill: '#94a3b8' }));

  return root;
}

// ─── ELEGANT ──────────────────────────────────────────────
function buildElegant(
  qrSvg: SVGElement, tableLabel: string, restaurantName: string,
  tagline: string | null, colors: Required<QRTemplateColors>
): SVGSVGElement {
  const W = 500, H = 660, qrSize = 280;
  const qrX = (W - qrSize) / 2, qrY = 200;
  const root = createRoot(W, H);

  root.appendChild(el('rect', { width: String(W), height: String(H), rx: '0', fill: colors.background }));

  // Triple border
  root.appendChild(el('rect', { x: '8', y: '8', width: String(W - 16), height: String(H - 16), fill: 'none', stroke: colors.border, 'stroke-width': '2' }));
  root.appendChild(el('rect', { x: '14', y: '14', width: String(W - 28), height: String(H - 28), fill: 'none', stroke: colors.accent, 'stroke-width': '0.5' }));
  root.appendChild(el('rect', { x: '20', y: '20', width: String(W - 40), height: String(H - 40), fill: 'none', stroke: colors.border, 'stroke-width': '1' }));

  // Corner flourishes
  const cornerSize = 30;
  const corners = [
    { x: 20, y: 20, sx: 1, sy: 1 },
    { x: W - 20, y: 20, sx: -1, sy: 1 },
    { x: 20, y: H - 20, sx: 1, sy: -1 },
    { x: W - 20, y: H - 20, sx: -1, sy: -1 },
  ];
  corners.forEach(({ x, y, sx, sy }) => {
    const path = `M${x} ${y} C${x + sx * cornerSize} ${y}, ${x} ${y + sy * cornerSize}, ${x + sx * cornerSize * 0.7} ${y + sy * cornerSize * 0.7}`;
    root.appendChild(el('path', { d: path, fill: 'none', stroke: colors.accent, 'stroke-width': '1.5' }));
  });

  // Decorative top divider
  const mid = W / 2;
  root.appendChild(el('line', { x1: '50', y1: '60', x2: String(mid - 50), y2: '60', stroke: colors.accent, 'stroke-width': '0.5' }));
  root.appendChild(el('path', { d: `M${mid - 12} 55 L${mid} 50 L${mid + 12} 55 L${mid} 60 Z`, fill: colors.accent, opacity: '0.6' }));
  root.appendChild(el('line', { x1: String(mid + 50), y1: '60', x2: String(W - 50), y2: '60', stroke: colors.accent, 'stroke-width': '0.5' }));

  root.appendChild(text(restaurantName.toUpperCase(), { x: String(mid), y: '100', 'text-anchor': 'middle', 'font-family': 'Outfit, Georgia, serif', 'font-weight': '700', 'font-size': '24', fill: colors.text, 'letter-spacing': '3' }));
  root.appendChild(text('— SCAN TO ORDER —', { x: String(mid), y: '130', 'text-anchor': 'middle', 'font-family': 'Plus Jakarta Sans, Georgia, serif', 'font-weight': '400', 'font-size': '12', fill: colors.accent, 'letter-spacing': '4' }));

  // Divider below subtitle
  root.appendChild(el('line', { x1: String(mid - 60), y1: '150', x2: String(mid + 60), y2: '150', stroke: colors.accent, 'stroke-width': '0.5' }));
  root.appendChild(el('circle', { cx: String(mid), cy: '150', r: '3', fill: colors.accent }));

  // QR box
  root.appendChild(el('rect', { x: String(qrX - 20), y: String(qrY - 20), width: String(qrSize + 40), height: String(qrSize + 40), rx: '4', fill: colors.qrBg, stroke: colors.accent, 'stroke-width': '0.5' }));

  const g = el('g', { transform: `translate(${qrX}, ${qrY})` });
  g.appendChild(cloneQR(qrSvg, qrSize));
  root.appendChild(g);

  root.appendChild(text(tableLabel, { x: String(mid), y: String(qrY + qrSize + 55), 'text-anchor': 'middle', 'font-family': 'Outfit, Georgia, serif', 'font-weight': '700', 'font-size': '30', fill: colors.border }));

  // Bottom ornament
  root.appendChild(el('line', { x1: '50', y1: String(H - 60), x2: String(mid - 50), y2: String(H - 60), stroke: colors.accent, 'stroke-width': '0.5' }));
  root.appendChild(el('path', { d: `M${mid - 12} ${H - 65} L${mid} ${H - 70} L${mid + 12} ${H - 65} L${mid} ${H - 60} Z`, fill: colors.accent, opacity: '0.6' }));
  root.appendChild(el('line', { x1: String(mid + 50), y1: String(H - 60), x2: String(W - 50), y2: String(H - 60), stroke: colors.accent, 'stroke-width': '0.5' }));

  if (tagline) {
    root.appendChild(text(tagline, { x: String(mid), y: String(H - 35), 'text-anchor': 'middle', 'font-family': 'Plus Jakarta Sans, Georgia, serif', 'font-weight': '400', 'font-size': '11', fill: '#94a3b8', 'font-style': 'italic' }));
  }

  return root;
}

// ─── PUBLIC API ───────────────────────────────────────────
export function buildQRFrame(
  templateId: QRTemplateId,
  qrSvg: SVGElement,
  tableLabel: string,
  restaurantName: string,
  tagline: string | null,
  defaultColors: { primary: string; accent: string },
  overrides: QRTemplateColors = {}
): SVGSVGElement {
  const colors: Required<QRTemplateColors> = {
    border: overrides.border || defaultColors.primary,
    accent: overrides.accent || defaultColors.accent,
    text: overrides.text || '#0f172a',
    background: overrides.background || '#ffffff',
    qrBg: overrides.qrBg || '#f8fafc',
  };

  switch (templateId) {
    case 'modern': return buildModern(qrSvg, tableLabel, restaurantName, tagline, colors);
    case 'minimal': return buildMinimal(qrSvg, tableLabel, restaurantName, tagline, colors);
    case 'elegant': return buildElegant(qrSvg, tableLabel, restaurantName, tagline, colors);
    default: return buildClassic(qrSvg, tableLabel, restaurantName, tagline, colors);
  }
}
