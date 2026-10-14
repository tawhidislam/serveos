import { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Crop as CropIcon, Loader2 } from 'lucide-react';

interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

const ASPECT_OPTIONS = [
  { label: 'Free', value: 'free' },
  { label: '1:1', value: '1' },
  { label: '4:3', value: '1.333' },
  { label: '16:9', value: '1.778' },
  { label: '3:4', value: '0.75' },
];

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

export default function ImageCropDialog({ open, imageSrc, onCropComplete, onCancel }: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const initialCrop = centerAspectCrop(naturalWidth, naturalHeight, aspect ?? 1);
    setCrop(initialCrop);
  }, [aspect]);

  const handleAspectChange = (value: string) => {
    if (value === 'free') {
      setAspect(undefined);
    } else {
      const numAspect = parseFloat(value);
      setAspect(numAspect);
      if (imgRef.current) {
        const { naturalWidth, naturalHeight } = imgRef.current;
        setCrop(centerAspectCrop(naturalWidth, naturalHeight, numAspect));
      }
    }
  };

  const getCroppedBlob = useCallback(async (): Promise<Blob> => {
    const image = imgRef.current;
    if (!image || !completedCrop) throw new Error('No crop data');

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(completedCrop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(completedCrop.height * scaleY * pixelRatio);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        0.92,
      );
    });
  }, [completedCrop]);

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      const blob = await getCroppedBlob();
      onCropComplete(blob);
    } catch (err) {
      console.error('Crop failed', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => {
    // Convert original image to blob and pass through
    fetch(imageSrc)
      .then(r => r.blob())
      .then(blob => onCropComplete(blob))
      .catch(() => onCancel());
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            Crop Image
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto py-2">
          <div className="mb-3 flex justify-center">
            <ToggleGroup
              type="single"
              value={aspect === undefined ? 'free' : String(aspect)}
              onValueChange={(v) => v && handleAspectChange(v)}
              size="sm"
            >
              {ASPECT_OPTIONS.map((opt) => (
                <ToggleGroupItem key={opt.value} value={opt.value} className="text-xs px-3">
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex justify-center bg-muted/30 rounded-lg p-2">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              className="max-h-[50dvh]"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                className="max-h-[50dvh] object-contain"
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip Crop
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!completedCrop || processing}>
            {processing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CropIcon className="h-4 w-4 mr-1" />}
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
