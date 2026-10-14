import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import NotFound from '@/pages/NotFound';
import { usePageSlugs, PAGE_KEYS, type PageKey } from '@/hooks/usePageSlugs';
import AboutPage from '@/pages/AboutPage';
import GalleryPage from '@/pages/GalleryPage';
import ContactPage from '@/pages/ContactPage';
import MenuPage from '@/pages/MenuPage';

const PAGE_COMPONENTS: Record<PageKey, ReactNode> = {
  menu: <MenuPage />,
  about: <AboutPage />,
  gallery: <GalleryPage />,
  contact: <ContactPage />,
};

/**
 * Resolves a free-form `/:slug` URL against the tenant's custom static-page
 * mappings (`restaurants.page_slugs`). If the slug doesn't match any mapping,
 * we render the 404 page so SPA fallbacks don't swallow legitimate misses.
 *
 * Used as the catch-all on tenant custom domains — the originals (/menu,
 * /about, /gallery, /contact) remain reachable through their own routes.
 */
export default function PageSlugRouter() {
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const { slugs } = usePageSlugs();

  if (!pageSlug) return <NotFound />;
  const normalized = pageSlug.toLowerCase();

  for (const key of PAGE_KEYS) {
    if (slugs[key] === normalized) return <>{PAGE_COMPONENTS[key]}</>;
  }
  return <NotFound />;
}
