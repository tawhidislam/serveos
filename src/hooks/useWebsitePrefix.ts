import { useParams } from 'react-router-dom';

/**
 * Returns the route prefix to keep navigation scoped to a tenant.
 * - On `/r/:slug/*` routes returns `/r/:slug`.
 * - On custom-domain or root routes returns ''.
 *
 * Use `withPrefix('/menu')` to safely build slug-aware links.
 */
export function useWebsitePrefix() {
  const { slug } = useParams<{ slug?: string }>();
  const prefix = slug ? `/r/${slug}` : '';
  const withPrefix = (path: string) => {
    if (!path.startsWith('/')) return path;
    if (!prefix) return path;
    if (path === '/') return prefix;
    return `${prefix}${path}`;
  };
  return { prefix, withPrefix, slug };
}
