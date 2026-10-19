/**
 * XHR-based storage uploads with progress reporting.
 *
 * The Supabase JS client uses fetch, which cannot report upload progress.
 * This helper talks to the Storage REST endpoint directly so we can surface
 * a real progress bar (and support cancel / retry) for large images.
 */
import { supabase } from '@/integrations/supabase/client';

const STORAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface UploadOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  upsert?: boolean;
  cacheControl?: string;
  contentType?: string;
  /** 0-100 */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** Uploads a file to a storage bucket, reporting progress. Throws on failure. */
export async function uploadWithProgress({
  bucket,
  path,
  file,
  upsert = false,
  cacheControl = '3600',
  contentType,
  onProgress,
  signal,
}: UploadOptions): Promise<{ path: string; publicUrl: string }> {
  const cancelled = () => new DOMException('Upload cancelled', 'AbortError');
  if (signal?.aborted) throw cancelled();
  // compressImage() may have re-encoded the image (e.g. to WebP). Align the
  // path extension and content type with the bytes actually being sent, so
  // callers can keep building paths/content types from the original file.
  const fileType = (file as File).type?.toLowerCase() ?? '';
  const IMAGE_EXT: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
  if (IMAGE_EXT[fileType]) {
    path = path.replace(/\.(jpe?g|png|webp)$/i, `.${IMAGE_EXT[fileType]}`);
    if (contentType?.toLowerCase().startsWith('image/')) contentType = fileType;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (signal?.aborted) throw cancelled();
  const token = sessionData.session?.access_token ?? ANON_KEY;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const fail = (error: Error) => { cleanup(); reject(error); };
    const abort = () => {
      // Reject explicitly: aborting an XHR before send() need not fire onabort.
      fail(cancelled());
      xhr.abort();
    };
    xhr.open('POST', `${STORAGE_URL}/${bucket}/${encodeURI(path)}`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', ANON_KEY);
    xhr.setRequestHeader('x-upsert', String(upsert));
    xhr.setRequestHeader('cache-control', `max-age=${cacheControl}`);
    xhr.setRequestHeader('content-type', contentType || (file as File).type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          message = body.message || body.error || message;
        } catch {
          /* keep default */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => fail(new Error('Network error — check your connection and try again'));
    xhr.ontimeout = () => fail(new Error('Upload timed out — please try again'));
    xhr.onabort = () => fail(cancelled());

    if (signal) {
      if (signal.aborted) {
        abort();
        return;
      }
      signal.addEventListener('abort', abort, { once: true });
    }

    try { xhr.send(file); }
    catch (error) { cleanup(); reject(error); }
  });

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
