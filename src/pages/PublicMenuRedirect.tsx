import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRestaurantBySlug } from '@/hooks/useCurrentRestaurant';
import MenuPage from './MenuPage';

/**
 * Public slug-based menu entry point: /r/:slug/menu
 *
 * Resolves the tenant from the slug, persists it in sessionStorage,
 * then renders the MenuPage in-place (URL stays at /r/:slug/menu).
 */
export default function PublicMenuRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: restaurant, isLoading } = useRestaurantBySlug(slug);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!restaurant) {
      navigate('/404', { replace: true });
      return;
    }
    sessionStorage.setItem('active_restaurant_slug', restaurant.slug);
    sessionStorage.setItem('active_restaurant_id', restaurant.id);
    setReady(true);
  }, [restaurant, isLoading, navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return <MenuPage />;
}
