#!/usr/bin/env node
/**
 * ServeOS Local Print Agent
 * =========================
 * Enables TRUE silent printing (no print dialog) for the web app.
 *
 * Why this exists:
 *   Browsers cannot skip the print dialog from JavaScript — it's a hard
 *   security boundary. This tiny agent runs on the restaurant's POS/admin
 *   machine, receives print jobs from the web app over localhost, renders
 *   the HTML to PDF with headless Chrome (so all thermal @page CSS is
 *   respected), and sends it straight to the OS print queue via `lp`.
 *   Paper comes out. No dialog. No clicks.
 *
 * Zero dependencies — plain Node (>= 18) + Chrome + CUPS (`lp`).
 *
 * Run:
 *   npm run print-agent          (foreground)
 *   npm run print-agent:daemon   (background, logs to scripts/.print-agent.log)
 *
 * Endpoints (localhost only):
 *   GET  /health          → { ok: true, printer, chrome: true }
 *   POST /print           → body: { html, printer?, copies?, jobName? }
 *                           → { ok: true, jobId } | { ok: false, error }
 *
 * The web app auto-detects the agent (see src/lib/print-html.ts):
 *   - Agent running   → silent print (this script).
 *   - Agent down      → falls back to the hidden-iframe print dialog.
 */
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

/* ── config ─────────────────────────────────────────── */

const PORT = Number(process.env.PRINT_AGENT_PORT || 38123);
const HOST = '127.0.0.1'; // localhost only — never expose off-device
const DEFAULT_PRINTER = process.env.PRINT_AGENT_PRINTER || ''; // '' = CUPS default
const CHROME_PATH =
  process.env.PRINT_AGENT_CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const KEEP_PDF = process.env.PRINT_AGENT_KEEP_PDF === 'true'; // debug: keep rendered PDFs
const PDF_DIR = join(tmpdir(), 'serveos-print-agent');

/* ── helpers ────────────────────────────────────────── */

function log(...args) {
  console.log(`[print-agent] ${new Date().toISOString()}`, ...args);
}

/** Find Chrome across platforms. */
async function findChrome() {
  const candidates = [
    CHROME_PATH,
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
  for (const p of candidates) {
    try {
      await execFileAsync(p, ['--version']);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Resolve the printer name to use. */
async function resolvePrinter(requested) {
  if (requested) return requested;
  if (DEFAULT_PRINTER) return DEFAULT_PRINTER;
  // Ask CUPS for the system default printer.
  try {
    const { stdout } = await execFileAsync('lpstat', ['-d']);
    const m = stdout.match(/for\s+(.+?):\s*$/);
    if (m) return m[1].trim();
  } catch {
    /* no default set */
  }
  // Fall back to the first accepting destination.
  try {
    const { stdout } = await execFileAsync('lpstat', ['-a']);
    const first = stdout.split('\n')[0]?.split(/\s+/)[0];
    if (first) return first;
  } catch {
    /* no printers at all */
  }
  return null;
}

/** Render HTML → PDF via headless Chrome. Respects @page size (80mm thermal). */
async function renderPdf(chromePath, html, pdfPath) {
  const htmlPath = pdfPath.replace(/\.pdf$/, '.html');
  await writeFile(htmlPath, html, 'utf8');

  await execFileAsync(chromePath, [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ]);

  return htmlPath; // caller deletes it alongside the pdf
}

/* ── HTTP server ────────────────────────────────────── */

let chrome = null;
let cachedPrinter = null;

const server = http.createServer(async (req, res) => {
  const send = (code, payload) => {
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end(JSON.stringify(payload));
  };

  if (req.method === 'OPTIONS') return send(200, {});

  if (req.method === 'GET' && req.url === '/health') {
    const printer = await resolvePrinter(null);
    cachedPrinter = printer;
    return send(200, { ok: true, printer, chrome: Boolean(chrome) });
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 5_000_000) req.destroy(); // 5 MB guard
    });
    req.on('end', async () => {
      try {
        const { html, printer, copies, jobName } = JSON.parse(body);
        if (typeof html !== 'string' || html.length === 0) {
          return send(400, { ok: false, error: 'html is required' });
        }

        const target = await resolvePrinter(printer);
        if (!target) {
          return send(503, { ok: false, error: 'No printer configured on this machine (System Settings → Printers).' });
        }

        await mkdir(PDF_DIR, { recursive: true });
        const id = randomUUID();
        const pdfPath = join(PDF_DIR, `${jobName || 'order'}-${id}.pdf`);
        const htmlPath = await renderPdf(chrome, html, pdfPath);

        const args = ['-d', target, '-n', String(Math.max(1, Math.min(10, Number(copies) || 1)))];
        if (jobName) args.push('-t', jobName);
        args.push(pdfPath);
        const { stdout } = await execFileAsync('lp', args);
        const jobId = (stdout.match(/request id is (\S+)/) || [])[1] || null;

        log(`printed job ${jobId || '?'} → ${target}`);
        if (!KEEP_PDF) {
          await unlink(pdfPath).catch(() => {});
          await unlink(htmlPath).catch(() => {});
        }
        return send(200, { ok: true, jobId, printer: target });
      } catch (err) {
        log('print failed:', err.message);
        return send(500, { ok: false, error: String(err?.message || err) });
      }
    });
    return;
  }

  return send(404, { ok: false, error: 'not found' });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[print-agent] Port ${PORT} already in use — agent is probably already running.`);
    process.exit(1);
  }
  console.error('[print-agent] server error:', err.message);
});

/* ── startup ────────────────────────────────────────── */

chrome = await findChrome();
if (!chrome) {
  console.error(
    '[print-agent] Chrome not found. Install Google Chrome, or set PRINT_AGENT_CHROME to a Chromium binary.'
  );
  process.exit(1);
}

cachedPrinter = await resolvePrinter(null);
if (!cachedPrinter) {
  log('WARNING: no printer configured yet — /print will return 503 until one is added.');
}

server.listen(PORT, HOST, () => {
  log(`listening on http://${HOST}:${PORT}`);
  log(`chrome: ${chrome}`);
  log(`printer: ${cachedPrinter || '(none — set PRINT_AGENT_PRINTER or add one in System Settings)'}`);
  log('web app will now silently print when auto-print is ON');
});
