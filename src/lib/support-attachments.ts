import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { formatBytes, sniffImageMime } from '@/lib/upload-limits';

export const SUPPORT_BUCKET = 'support-attachments';
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']);

export interface SupportAttachment {
  path: string;
  name: string;
  size: number;
  mime: string;
}

type Client = SupabaseClient<Database>;

export function isImageAttachment(a: Pick<SupportAttachment, 'mime'>) {
  return a.mime.startsWith('image/');
}

/** Returns an error message, or null when the file can be attached. */
export function validateAttachment(file: File): string | null {
  if (file.size === 0) return `"${file.name}" is empty`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `"${file.name}" is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}`;
  if (!ALLOWED.has(file.type)) return `"${file.name}" isn't supported — attach images, PDFs or text files`;
  return null;
}

function safeName(name: string) {
  const cleaned = name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (cleaned || 'file').slice(-80);
}

/**
 * Upload one file to the conversation's folder. Must use the same client the
 * requester chats with (visitors use the isolated support client), because
 * storage access is checked against that session.
 */
export async function uploadSupportAttachment(client: Client, conversationId: string, file: File): Promise<SupportAttachment> {
  const problem = validateAttachment(file);
  if (problem) throw new Error(problem);

  let payload: File = file;
  if (file.type.startsWith('image/') && file.type !== 'image/gif') {
    // Reject renamed non-images, then shrink photos before upload.
    const sniffed = await sniffImageMime(file);
    if (!sniffed) throw new Error(`"${file.name}" is not a valid image`);
    payload = await compressImage(file, COMPRESS_PRESETS.content);
  }

  const path = `${conversationId}/${crypto.randomUUID()}-${safeName(payload.name)}`;
  const { error } = await client.storage.from(SUPPORT_BUCKET).upload(path, payload, {
    contentType: payload.type,
    upsert: false,
  });
  if (error) throw error;
  return { path, name: file.name, size: payload.size, mime: payload.type };
}

/** Short-lived link for viewing an attachment (bucket is private). */
export async function getSupportAttachmentUrl(client: Client, path: string): Promise<string | null> {
  const { data } = await client.storage.from(SUPPORT_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function parseAttachments(value: unknown): SupportAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is SupportAttachment =>
      !!a && typeof a === 'object' && typeof (a as SupportAttachment).path === 'string',
  ).map((a) => ({ path: a.path, name: a.name || 'file', size: Number(a.size) || 0, mime: a.mime || 'application/octet-stream' }));
}
