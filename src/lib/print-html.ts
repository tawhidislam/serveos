/**
 * Hidden-iframe printing utility with local print-agent support.
 *
 * Two print paths, chosen automatically:
 *
 * 1. LOCAL PRINT AGENT (true silent printing — no dialog)
 *    If the restaurant machine runs `npm run print-agent`, this module
 *    POSTs the HTML to http://127.0.0.1:38123/print. The agent renders
 *    it to PDF via headless Chrome (respecting the 80mm thermal @page
 *    CSS) and sends it straight to the OS print queue via `lp`.
 *    Paper comes out with zero dialogs.
 *
 * 2. HIDDEN IFRAME (fallback — shows the print dialog)
 *    Browsers cannot skip the print dialog from JavaScript, so without
 *    the agent we write the document into a hidden same-origin iframe
 *    and call `contentWindow.print()`. Unlike `window.open`, this works
 *    from non-gesture contexts (Supabase realtime callbacks) and is
 *    not affected by popup blockers.
 */

const AGENT_URL = 'http://127.0.0.1:38123';
const AGENT_TIMEOUT_MS = 3_000;

/** Cached agent availability — probed once, re-probed on failure. */
let agentAvailable: boolean | null = null;
let agentProbe: Promise<boolean> | null = null;

/** Probe the local print agent (GET /health). */
function probeAgent(): Promise<boolean> {
  if (agentProbe) return agentProbe;
  agentProbe = fetch(`${AGENT_URL}/health`, { signal: AbortSignal.timeout(AGENT_TIMEOUT_MS) })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      agentProbe = null;
    });
  return agentProbe;
}

/** Mark the agent as (probably) gone so the next call re-probes. */
function invalidateAgent(): void {
  agentAvailable = null;
}

/**
 * Check whether the local print agent is running.
 * Useful for UI status indicators (e.g. the admin toolbar).
 */
export function isPrintAgentAvailable(): Promise<boolean> {
  if (agentAvailable !== null) return Promise.resolve(agentAvailable);
  return probeAgent().then((ok) => {
    agentAvailable = ok;
    return ok;
  });
}

/** POST an HTML document to the local print agent for silent printing. */
async function printViaAgent(html: string, jobName?: string): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, jobName }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && data?.ok) return true;
    console.warn('[print] agent rejected job:', data?.error ?? res.status);
    return false;
  } catch {
    invalidateAgent();
    return false;
  }
}

/**
 * Print an arbitrary HTML document.
 *
 * Tries the local print agent first (silent); if it's not running or
 * fails, falls back to the hidden-iframe print dialog.
 */
export function printHtml(html: string, opts?: { jobName?: string }): void {
  void isPrintAgentAvailable().then((available) => {
    if (available) {
      void printViaAgent(html, opts?.jobName).then((ok) => {
        if (!ok) printViaIframe(html);
      });
    } else {
      printViaIframe(html);
    }
  });
}

/**
 * Print an arbitrary HTML document via a hidden iframe.
 *
 * The iframe is appended to the body, waits for the document to be ready,
 * invokes print, and removes itself afterwards. Safe to call repeatedly
 * (e.g. once per incoming order).
 */
function printViaIframe(html: string): void {
  const iframe = document.createElement('iframe');
  // Zero-size, fixed position — never visible, never affects layout.
  iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;

  const cleanup = () => {
    try {
      iframe.removeEventListener('load', onLoad);
      iframe.removeEventListener('afterprint', cleanup);
      iframe.remove();
    } catch {
      /* noop — iframe may already be gone */
    }
  };

  const doPrint = () => {
    try {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }
      win.focus();
      win.print();
    } catch {
      /* noop — printing is best-effort */
    }
    // Fallback removal in case afterprint never fires (some browsers).
    setTimeout(cleanup, 60_000);
  };

  const onLoad = () => {
    const doc = iframe.contentDocument;
    if (doc && doc.readyState === 'complete') {
      doPrint();
    } else {
      // readyState 'loading'/'interactive' — wait a tick for styles to apply.
      setTimeout(doPrint, 50);
    }
  };

  iframe.addEventListener('load', onLoad);
  iframe.addEventListener('afterprint', cleanup);

  document.body.appendChild(iframe);

  // srcdoc keeps everything same-origin and lets the browser fire `load`.
  iframe.srcdoc = html;
}
