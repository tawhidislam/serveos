import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { compressImage, COMPRESS_PRESETS, type CompressOptions } from '@/lib/image-compress';
import { validateImageFile, type ImageSizeLimitKey } from '@/lib/upload-limits';
import { uploadWithProgress } from '@/lib/storage-upload';

interface UseImageUploadOptions {
  bucket: string;
  /** Builds the storage path for a given file */
  buildPath: (file: File) => string;
  upsert?: boolean;
  /** Size limit key or bytes (default 'image') */
  limit?: ImageSizeLimitKey | number;
  /** Compression preset / options (default content preset) */
  compress?: CompressOptions | false;
  /** Called with the public URL after a successful upload */
  onUploaded?: (url: string, path: string) => void | Promise<void>;
  successMessage?: string | null;
}

/**
 * Handles validate → compress → upload with live progress, cancel and retry.
 */
export function useImageUpload({
  bucket,
  buildPath,
  upsert = false,
  limit = 'image',
  compress = COMPRESS_PRESETS.content,
  onUploaded,
  successMessage = 'Image uploaded',
}: UseImageUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const lastFile = useRef<File | null>(null);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(
    async (file: File) => {
      lastFile.current = file;
      setFileName(file.name);
      setError(null);
      setProgress(0);
      setUploading(true);
      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        const payload = compress === false ? file : await compressImage(file, compress);
        const { publicUrl, path } = await uploadWithProgress({
          bucket,
          path: buildPath(file),
          file: payload,
          upsert,
          onProgress: setProgress,
          signal: ctrl.signal,
        });
        await onUploaded?.(publicUrl, path);
        if (successMessage) toast.success(successMessage);
        setError(null);
        return publicUrl;
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          setError(null);
          return null;
        }
        const message = e?.message || 'Upload failed';
        setError(message);
        toast.error(message);
        return null;
      } finally {
        controller.current = null;
        setUploading(false);
      }
    },
    [bucket, buildPath, compress, onUploaded, successMessage, upsert],
  );

  /** Validates then uploads. Returns the public URL or null. */
  const upload = useCallback(
    async (file: File) => {
      if (!validateImageFile(file, limit)) return null;
      return run(file);
    },
    [limit, run],
  );

  const retry = useCallback(() => {
    if (lastFile.current) void run(lastFile.current);
  }, [run]);

  const cancel = useCallback(() => controller.current?.abort(), []);

  const reset = useCallback(() => {
    setError(null);
    setProgress(0);
    setFileName(null);
    lastFile.current = null;
  }, []);

  return { upload, retry, cancel, reset, uploading, progress, error, fileName };
}
