import { useEffect } from 'react';

type SeoHeadOptions = {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
  type?: string;
  /** JSON-LD object injected as a <script type="application/ld+json"> tag. */
  jsonLd?: Record<string, any> | null;
  /** Skip all head mutations (e.g. inside the editor's live preview iframe). */
  disabled?: boolean;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function toAbsolute(url?: string | null) {
  if (!url) return '';
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return '';
  }
}

/**
 * Applies per-tenant SEO metadata to the document head so it is live on the
 * published site (title, description, canonical, Open Graph, Twitter, JSON-LD).
 */
export function useSeoHead({
  title,
  description,
  imageUrl,
  canonicalUrl,
  noindex,
  type = 'website',
  jsonLd,
  disabled,
}: SeoHeadOptions) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    if (disabled || typeof document === 'undefined') return;

    const canonical = toAbsolute(canonicalUrl) || window.location.href.split('?')[0].split('#')[0];

    if (title) {
      document.title = title;
      upsertMeta('property', 'og:title', title);
      upsertMeta('name', 'twitter:title', title);
    }
    if (description) {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:description', description);
      upsertMeta('name', 'twitter:description', description);
    }

    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:url', canonical);
    upsertLink('canonical', canonical);

    const absImage = toAbsolute(imageUrl);
    if (absImage) {
      upsertMeta('property', 'og:image', absImage);
      upsertMeta('name', 'twitter:image', absImage);
      upsertMeta('name', 'twitter:card', 'summary_large_image');
    } else {
      upsertMeta('name', 'twitter:card', 'summary');
    }

    if (noindex) upsertMeta('name', 'robots', 'noindex, nofollow');
    else removeMeta('name', 'robots');

    let script: HTMLScriptElement | null = null;
    if (ld) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.seoHead = 'true';
      script.text = ld;
      document.head.appendChild(script);
    }
    return () => { script?.remove(); };
  }, [title, description, imageUrl, canonicalUrl, noindex, type, ld, disabled]);
}

export default useSeoHead;
