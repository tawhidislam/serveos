import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat } from 'lucide-react';

interface Props {
  menuItemId: string;
  mainImageUrl: string | null;
  itemName: string;
}

export default function ImageGalleryViewer({ menuItemId, mainImageUrl, itemName }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const lastDistance = useRef<number | null>(null);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);
  const isZoomed = scale > 1.05;

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    lastDistance.current = null;
    lastCenter.current = null;
  }, []);

  // Reset zoom on image change
  useEffect(() => { resetZoom(); }, [activeIndex, resetZoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDistance.current = Math.hypot(dx, dy);
      lastCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistance.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const newScale = Math.min(4, Math.max(1, scale * (dist / lastDistance.current)));
      lastDistance.current = dist;

      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      if (lastCenter.current) {
        setTranslate(prev => ({
          x: prev.x + (cx - lastCenter.current!.x),
          y: prev.y + (cy - lastCenter.current!.y),
        }));
      }
      lastCenter.current = { x: cx, y: cy };
      setScale(newScale);
    } else if (e.touches.length === 1 && isZoomed) {
      e.preventDefault();
    }
  }, [scale, isZoomed]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      lastDistance.current = null;
      lastCenter.current = null;
      if (scale <= 1.05) resetZoom();
    }
  }, [scale, resetZoom]);

  const { data: galleryImages = [] } = useQuery({
    queryKey: ['menu_item_images', menuItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_item_images')
        .select('*')
        .eq('menu_item_id', menuItemId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const allImages = [
    ...(mainImageUrl ? [{ id: 'main', image_url: mainImageUrl, caption: itemName }] : []),
    ...galleryImages,
  ];

  const goNext = useCallback(() => setActiveIndex(i => (i + 1) % allImages.length), [allImages.length]);
  const goPrev = useCallback(() => setActiveIndex(i => (i - 1 + allImages.length) % allImages.length), [allImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, goNext, goPrev]);

  if (allImages.length === 0) {
    return (
      <div className="aspect-square rounded-3xl overflow-hidden border border-white/[0.06]">
        <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
          <ChefHat className="h-20 w-20 text-white/[0.06]" strokeWidth={1} />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Main display */}
        <div
          className="aspect-square rounded-3xl overflow-hidden border border-white/[0.06] relative group cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={allImages[activeIndex].id}
              src={allImages[activeIndex].image_url}
              alt={allImages[activeIndex].caption || itemName}
              className="w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          </AnimatePresence>

          {/* Zoom hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
          </div>

          {/* Navigation arrows */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {allImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
                    className={`h-2 rounded-full transition-all ${
                      i === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {allImages[activeIndex].caption && allImages[activeIndex].id !== 'main' && (
            <div className="absolute bottom-10 left-3 right-3">
              <span className="bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
                {allImages[activeIndex].caption}
              </span>
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {allImages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {allImages.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActiveIndex(i)}
                className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  i === activeIndex
                    ? 'border-amber-500 ring-2 ring-amber-500/20'
                    : 'border-white/[0.06] hover:border-white/20'
                }`}
              >
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Counter */}
            {allImages.length > 1 && (
              <span className="absolute top-5 left-5 text-white/50 text-sm tabular-nums z-10">
                {activeIndex + 1} / {allImages.length}
              </span>
            )}

            {/* Image with swipe + pinch-to-zoom */}
            <motion.div
              drag={allImages.length > 1 && !isZoomed ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onDragEnd={(_e, info) => {
                if (!isZoomed) {
                  if (info.offset.x < -60) goNext();
                  else if (info.offset.x > 60) goPrev();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDoubleClick={() => isZoomed ? resetZoom() : setScale(2.5)}
              className="max-h-[85dvh] max-w-[90vw] touch-none"
              style={{
                transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                transition: lastDistance.current ? 'none' : 'transform 0.2s ease-out',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={allImages[activeIndex].id}
                  src={allImages[activeIndex].image_url}
                  alt={allImages[activeIndex].caption || itemName}
                  className="max-h-[85dvh] max-w-[90vw] object-contain rounded-lg select-none pointer-events-none"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  draggable={false}
                />
              </AnimatePresence>
            </motion.div>

            {/* Caption */}
            {allImages[activeIndex].caption && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
                <span className="bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full">
                  {allImages[activeIndex].caption}
                </span>
              </div>
            )}

            {/* Arrows */}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Thumbnail strip */}
            {allImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {allImages.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      i === activeIndex ? 'border-white ring-1 ring-white/30' : 'border-white/20 opacity-50 hover:opacity-80'
                    }`}
                  >
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}