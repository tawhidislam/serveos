import type { ComponentType } from 'react';
import ClassicLayout from './ClassicLayout';
import GalleryLayout from './GalleryLayout';
import CompactLayout from './CompactLayout';
import ShowcaseLayout from './ShowcaseLayout';
import type { OrderLayoutProps, OrderPageTemplateId } from './types';

export * from './types';

export const ORDER_LAYOUTS: Record<OrderPageTemplateId, ComponentType<OrderLayoutProps>> = {
  classic: ClassicLayout,
  gallery: GalleryLayout,
  compact: CompactLayout,
  showcase: ShowcaseLayout,
};
