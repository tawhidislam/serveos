import { useRestaurantTheme } from '@/hooks/usePlatformThemes';
import { Suspense, useEffect, useState } from 'react';
import { lazyWithRetry as lazy } from '@/lib/lazyWithRetry';
import { useSearchParams, useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useHomepageContent } from '@/hooks/useHomepageContent';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useCurrentRestaurant, useRestaurantBySlug } from '@/hooks/useCurrentRestaurant';
import WebsiteLayout from '@/components/website/WebsiteLayout';
import { useSeoHead } from '@/hooks/useSeoHead';
import { clean, resolveContact, toPostalAddress } from '@/lib/contact-info';


// Lazy-load homepage templates so visitors only download the one their
// restaurant has selected — not all 7 variants up-front.
const ClassicHome = lazy(() => import('@/components/website/templates/ClassicHome'));
const ModernHome = lazy(() => import('@/components/website/templates/ModernHome'));
const BistroHome = lazy(() => import('@/components/website/templates/BistroHome'));
const ElegantHome = lazy(() => import('@/components/website/templates/ElegantHome'));
const CafeHome = lazy(() => import('@/components/website/templates/CafeHome'));
const MinimalHome = lazy(() => import('@/components/website/templates/MinimalHome'));
const DefaultHome = lazy(() => import('@/components/website/templates/DefaultHome'));
const GrandHome = lazy(() => import('@/components/website/templates/GrandHome'));

export default function HomePage() {
  const { user, hasAnyRole, loading, getDashboardPath } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  // Resolve the active restaurant: by URL slug (/r/:slug) when present,
  // otherwise from current user / custom domain context.
  const { data: slugRestaurant } = useRestaurantBySlug(slug);
  const { data: currentRestaurant } = useCurrentRestaurant();
  const restaurant = slug ? slugRestaurant : currentRestaurant;
  const restaurantId = restaurant?.id ?? null;

  const { data: settings } = useSettings();
  const { format } = useCurrency();
  const { data: content } = useHomepageContent(restaurantId);
  const themeColors = useThemeColors();
  const name = restaurant?.name || settings?.restaurant_name || 'RestaurantOS';
  const [searchParams] = useSearchParams();
  const previewOverride = searchParams.get('_preview_template');
  const { data: assignedTheme } = useRestaurantTheme();
  const template = previewOverride || assignedTheme?.tokens.homepage_template || settings?.homepage_template || 'classic';
  const isLivePreview = searchParams.get('_live') === '1';

  // Unsaved editor state pushed in from the Homepage Editor over postMessage.
  const [liveSections, setLiveSections] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    if (!isLivePreview) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'serveos:preview-content') {
        setLiveSections(e.data.sections || {});
      }
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'serveos:preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [isLivePreview]);

  const liveContent: any = liveSections ? { ...(content as any), ...liveSections } : content;
  const liveThemeColors = liveSections?.theme_colors?.[template] || themeColors;

  const seo = (liveContent as any)?.seo;

  useEffect(() => {
    if (previewOverride) return;
    if (!loading && user && hasAnyRole(['owner', 'admin', 'manager', 'kitchen', 'waiter', 'server'])) {
      navigate(getDashboardPath(), { replace: true });
    }
  }, [loading, user, hasAnyRole, getDashboardPath, navigate]);

  // Per-tenant SEO from the Homepage Editor, applied to the live document head.
  const heroImage = (liveContent as any)?.hero?.hero_image_url;
  const seoTitle = seo?.meta_title || (restaurant?.name ? `${restaurant.name} — Menu, Reservations & Online Ordering` : name);
  const seoDescription = seo?.meta_description
    || (restaurant?.name ? `Browse the menu, order online and reserve a table at ${restaurant.name}.` : undefined);
  const seoImage = seo?.og_image_url || heroImage || null;

  // Structured-data + display contact details: editor content wins, then
  // restaurant settings, then the restaurant record itself.
  const seoContact = (liveContent as any)?.contact;
  const resolvedContact = resolveContact(
    seoContact,
    { phone: settings?.contact_phone, address: settings?.address },
    { phone: restaurant?.phone, address: restaurant?.address },
  );
  const ldPhone = resolvedContact.phoneDial || resolvedContact.phone;
  const ldAddress = resolvedContact.address;
  const ldPostalAddress = toPostalAddress(ldAddress);

  const ldCuisine = clean(seoContact?.cuisine) || clean(restaurant?.cuisine_type);


  useSeoHead({
    title: seoTitle,
    description: seoDescription,
    imageUrl: seoImage,
    canonicalUrl: seo?.canonical_url || null,
    noindex: !!seo?.noindex,
    disabled: isLivePreview || !!previewOverride,
    jsonLd: restaurant?.name
      ? {
          '@context': 'https://schema.org',
          '@type': 'Restaurant',
          name: restaurant.name,
          description: seoDescription,
          image: seoImage || undefined,
          url: seo?.canonical_url || (typeof window !== 'undefined' ? window.location.origin : undefined),
          servesCuisine: ldCuisine,
          telephone: ldPhone,
          address: ldPostalAddress,
        }

      : null,
  });

  const featuredConfig = (liveContent as any)?.featured_menu;
  const featuredItemIds: string[] = featuredConfig?.item_ids || [];

  const { data: featuredItems } = useQuery({
    queryKey: ['featured-menu-items', restaurantId, featuredItemIds],
    queryFn: async () => {
      if (featuredItemIds.length > 0) {
        let q = supabase
          .from('menu_items')
          .select('*, categories(name)')
          .in('id', featuredItemIds)
          .eq('is_available', true);
        if (restaurantId) q = q.eq('restaurant_id', restaurantId);
        const { data } = await q;
        const ordered = featuredItemIds
          .map(id => (data || []).find(item => item.id === id))
          .filter(Boolean);
        return ordered;
      }
      let q = supabase
        .from('menu_items')
        .select('*, categories(name)')
        .eq('is_available', true);
      if (restaurantId) q = q.eq('restaurant_id', restaurantId);
      const { data } = await q.order('sort_order').limit(6);
      return data || [];
    },
    // Wait for restaurant resolution before querying so no page ever falls
    // through to a cross-tenant global menu while the tenant is resolving.
    enabled: !!restaurantId,
  });

  const isStaff = !loading && user && hasAnyRole(['owner', 'admin', 'manager', 'kitchen', 'waiter', 'server']);

  if (loading || isStaff) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
      </div>
    );
  }

  // Give every template a contact block that already has the fallbacks and
  // formatting applied, while keeping editor-only fields (hours, email).
  const contentWithContact = {
    ...(liveContent as any),
    contact: {
      ...(seoContact || {}),
      phone: resolvedContact.phone,
      phone_href: resolvedContact.phoneHref,
      address: resolvedContact.address,
      address_line1: resolvedContact.addressLines[0],
      address_line2: resolvedContact.addressLines[1],
      maps_href: resolvedContact.mapsHref,
    },
  };

  const templateProps = {
    name,
    content: contentWithContact,
    featuredItems: featuredItems || [],
    format,
    featuredConfig,
    themeColors: liveThemeColors,
  };


  const templateMap: Record<string, React.ComponentType<any>> = {
    default: DefaultHome,
    classic: ClassicHome,
    modern: ModernHome,
    bistro: BistroHome,
    elegant: ElegantHome,
    cafe: CafeHome,
    minimal: MinimalHome,
    grand: GrandHome,
  };
  const TemplateComponent = templateMap[template] || ClassicHome;

  return (
    <WebsiteLayout templateOverride={template}>
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <TemplateComponent {...templateProps} />
      </Suspense>
    </WebsiteLayout>
  );
}
