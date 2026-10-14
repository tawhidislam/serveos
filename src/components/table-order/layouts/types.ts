export interface OrderMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  [key: string]: any;
}

export interface OrderCategoryGroup {
  id: string;
  name: string;
  items: OrderMenuItem[];
  [key: string]: any;
}

export interface OrderLayoutProps {
  groups: OrderCategoryGroup[];
  /** Registers the section element for a category so scroll-spy keeps working. */
  registerSection: (catId: string, el: HTMLDivElement | null) => void;
  getQty: (menuItemId: string) => number;
  format: (n: number) => string;
  onAdd: (item: OrderMenuItem) => void;
  onUpdateQty: (menuItemId: string, qty: number) => void;
  hasAddons: (menuItemId: string) => boolean;
  reducedMotion?: boolean;
}

export type OrderPageTemplateId = 'classic' | 'gallery' | 'compact' | 'showcase';

export const ORDER_PAGE_TEMPLATES: {
  id: OrderPageTemplateId;
  name: string;
  description: string;
}[] = [
  { id: 'classic', name: 'Classic list', description: 'Stacked rows with thumbnails — the default look.' },
  { id: 'gallery', name: 'Gallery grid', description: 'Two-column, image-first cards with price chips.' },
  { id: 'compact', name: 'Compact menu', description: 'Dense text-only list, fastest for large menus.' },
  { id: 'showcase', name: 'Showcase', description: 'Horizontally scrolling feature cards per category.' },
];

export function isOrderPageTemplate(v: unknown): v is OrderPageTemplateId {
  return typeof v === 'string' && ORDER_PAGE_TEMPLATES.some(t => t.id === v);
}
