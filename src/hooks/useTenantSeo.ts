import { useEffect } from 'react';

interface SeoOptions {
  title?: string;
  description?: string;
  ogImage?: string;
  canonicalPath?: string; // e.g. "/r/test-res/about"
  jsonLd?: Record<string, any> | Record<string, any>[];
  jsonLdId?: string; // unique id for the <script> tag, defaults to "tenant-jsonld"
}

/**
 * Sets <title>, meta description, Open Graph/Twitter tags, and a canonical
 * <link> for tenant-specific public pages. Restores nothing on unmount —
 * subsequent pages will overwrite these values.
 */
export function useTenantSeo({ title, description, ogImage, canonicalPath, jsonLd, jsonLdId = 'tenant-jsonld' }: SeoOptions) {
  useEffect(() => {
    if (title) document.title = title;

    const setMeta = (selector: string, value?: string) => {
      if (!value) return;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        const isProperty = selector.includes('property=');
        const match = selector.match(/(?:name|property)="([^"]+)"/);
        if (match) el.setAttribute(isProperty ? 'property' : 'name', match[1]);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };

    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:type"]', 'website');
    setMeta('meta[name="twitter:card"]', ogImage ? 'summary_large_image' : 'summary');
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    if (ogImage) {
      setMeta('meta[property="og:image"]', ogImage);
      setMeta('meta[name="twitter:image"]', ogImage);
    }

    if (canonicalPath) {
      const href = `${window.location.origin}${canonicalPath}`;
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
      setMeta('meta[property="og:url"]', href);
    }

    // JSON-LD structured data
    const existing = document.getElementById(jsonLdId);
    if (jsonLd) {
      const script = (existing as HTMLScriptElement) || document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.id = jsonLdId;
      script.textContent = JSON.stringify(jsonLd);
      if (!existing) document.head.appendChild(script);
    } else if (existing) {
      existing.remove();
    }
  }, [title, description, ogImage, canonicalPath, jsonLd, jsonLdId]);
}
