import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy with automatic recovery from "stale chunk" errors that
 * happen right after a new deploy: the user still has the old index.html in
 * memory, which references chunk filenames (e.g. MarketingLogin-BHwRaNvn.js)
 * that no longer exist on the server. The dynamic import then throws
 *   "Failed to fetch dynamically imported module"
 * or
 *   "Importing a module script failed"
 *
 * Strategy:
 *  1. On first failure for a session, set a sessionStorage flag and hard
 *     reload the page so the browser fetches the fresh index.html + manifest.
 *  2. If it fails again after the reload, give up and rethrow so the
 *     ErrorBoundary can show the real error (prevents reload loops).
 */
const RELOAD_KEY = "app:chunk-reload-attempt";
const RELOAD_WINDOW_MS = 60_000;

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = getChunkErrorMessage(err);
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

function getChunkErrorMessage(err: unknown): string {
  if (!err) return "";
  if (err instanceof ErrorEvent) return `${err.message} ${err.filename}`;
  if (err instanceof PromiseRejectionEvent) return getChunkErrorMessage(err.reason);
  if (err instanceof Event) {
    const target = err.target as HTMLScriptElement | HTMLLinkElement | null;
    return `${err.type} ${target?.getAttribute?.("src") || target?.getAttribute?.("href") || ""}`;
  }
  return (err as Error)?.message ?? String(err);
}

function getChunkErrorSignature(err: unknown): string {
  const msg = getChunkErrorMessage(err);
  const assetUrl = msg.match(/https?:\/\/[^\s)"']+\/assets\/[^\s)"']+/i)?.[0];
  return assetUrl || msg.slice(0, 240);
}

export function maybeRecoverFromChunkError(err: unknown): boolean {
  if (!isChunkLoadError(err) || typeof window === "undefined") return false;

  const signature = getChunkErrorSignature(err);
  const now = Date.now();
  let alreadyTriedThisChunk = false;

  try {
    const previous = JSON.parse(window.sessionStorage.getItem(RELOAD_KEY) || "null") as
      | { signature?: string; at?: number }
      | null;
    alreadyTriedThisChunk =
      previous?.signature === signature &&
      typeof previous.at === "number" &&
      now - previous.at < RELOAD_WINDOW_MS;
  } catch {
    /* ignore */
  }

  if (alreadyTriedThisChunk) return false;

  try {
    window.sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ signature, at: now }));
  } catch {
    /* ignore */
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("_chunk_reload", String(now));
  window.location.replace(nextUrl.toString());
  return true;
}

export function installGlobalChunkErrorHandler(): void {
  if (typeof window === "undefined" || (window as any).__appChunkHandlerInstalled) return;
  (window as any).__appChunkHandlerInstalled = true;

  window.addEventListener("error", (event) => {
    maybeRecoverFromChunkError(event.error || event);
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    if (maybeRecoverFromChunkError(event)) event.preventDefault();
  });
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      return mod;
    } catch (err) {
      if (!maybeRecoverFromChunkError(err)) throw err;

      // Return a never-resolving promise so React doesn't render the
      // ErrorBoundary while the reload is in flight.
      return new Promise<{ default: T }>(() => {});
    }
  });
}
