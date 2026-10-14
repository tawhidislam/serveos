import { Link } from 'react-router-dom';
import { resolveCtaHref, isExternalHref } from '@/lib/cta-destinations';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';
import { trackCtaClick } from '@/lib/cta-tracking';

/**
 * Renders a CTA as a router <Link> for internal paths and a plain <a> for
 * external / tel / mailto destinations. Every click is recorded for the
 * admin CTA analytics report.
 */
export default function CtaLink({
  to,
  fallback,
  className,
  source,
  label,
  children,
}: {
  to?: string | null;
  fallback: string;
  className?: string;
  /** Where on the page the CTA lives, e.g. "hero_primary". */
  source?: string;
  /** Button text, for reporting. */
  label?: string;
  children: React.ReactNode;
}) {
  const { withPrefix } = useWebsitePrefix();
  const { restaurantId } = useResolvedRestaurant();
  const href = resolveCtaHref(to, fallback, withPrefix);

  const handleClick = () => {
    void trackCtaClick({
      restaurantId,
      destination: (to ?? '').trim() || fallback,
      label,
      source,
    });
  };

  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
