import { Loader2, RotateCw, X, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadProgressProps {
  /** Upload in flight */
  uploading: boolean;
  /** 0-100 */
  progress: number;
  /** Error message from the last failed attempt */
  error?: string | null;
  /** Retries the last attempted upload */
  onRetry?: () => void;
  /** Cancels the in-flight upload */
  onCancel?: () => void;
  /** Name of the file being uploaded */
  fileName?: string | null;
  className?: string;
}

/** Shared upload progress bar with cancel + retry affordances. */
export function UploadProgress({
  uploading,
  progress,
  error,
  onRetry,
  onCancel,
  fileName,
  className,
}: UploadProgressProps) {
  if (!uploading && !error) return null;

  const statusText = uploading
    ? `Uploading${fileName ? ` ${fileName}` : ''}… ${progress}%`
    : `Upload failed${fileName ? ` for ${fileName}` : ''}: ${error}`;

  return (
    <div className={cn('rounded-lg ring-subtle bg-secondary/40 p-3 space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs">
        {uploading ? (
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 text-destructive shrink-0" />
        )}
        <span
          role="status"
          aria-live={uploading ? 'polite' : 'assertive'}
          aria-atomic="true"
          className="truncate text-muted-foreground flex-1"
        >
          {uploading ? (
            statusText
          ) : (
            <>
              <span className="sr-only">Upload failed{fileName ? ` for ${fileName}` : ''}: </span>
              {error}
            </>
          )}

        </span>
        {uploading && onCancel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            onClick={onCancel}
            aria-label={`Cancel upload${fileName ? ` of ${fileName}` : ''}`}
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        )}
        {!uploading && error && onRetry && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs gap-1"
            onClick={onRetry}
            aria-label={`Retry upload${fileName ? ` of ${fileName}` : ''}`}
          >
            <RotateCw aria-hidden="true" className="h-3 w-3" />
            Retry
          </Button>
        )}
      </div>
      {uploading && (
        <Progress
          value={progress}
          className="h-1.5"
          aria-label={`Upload progress${fileName ? ` for ${fileName}` : ''}`}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${progress}%`}
        />
      )}
    </div>
  );
}


export default UploadProgress;
