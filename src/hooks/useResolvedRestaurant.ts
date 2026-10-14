import { useParams } from 'react-router-dom';
import { useCurrentRestaurant, useRestaurantBySlug } from '@/hooks/useCurrentRestaurant';

/**
 * Resolves the active restaurant for any public website page.
 *
 * - When the URL has /r/:slug, fetches by slug.
 * - Otherwise uses the current context (custom domain, impersonation, or
 *   the authenticated user's membership).
 *
 * Used by tenant-facing pages (Menu, About, Gallery, Contact) so each
 * restaurant always sees only its own data.
 */
export function useResolvedRestaurant() {
  const { slug } = useParams<{ slug?: string }>();
  const { data: bySlug, isLoading: slugLoading } = useRestaurantBySlug(slug);
  const { data: current, isLoading: currentLoading } = useCurrentRestaurant();
  const restaurant = slug ? bySlug : current;
  return {
    restaurant: restaurant ?? null,
    restaurantId: restaurant?.id ?? null,
    isLoading: slug ? slugLoading : currentLoading,
  };
}
