import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import MarketingHome from '@/pages/marketing/MarketingHome';

const sections = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock('@/hooks/useMarketingSections', () => ({ useMarketingSections: () => sections }));
vi.mock('@/hooks/usePlatformSettings', () => ({ usePlatformBranding: () => ({ siteName: 'ServeOS', logoUrl: null }) }));
vi.mock('@/hooks/useSubscriptionPlans', () => ({ useSubscriptionPlans: () => ({ data: [] }) }));
vi.mock('@/hooks/usePlatformCurrency', () => ({ usePlatformCurrency: () => ({ currency: 'USD' }) }));
vi.mock('@/components/marketing/MarketingLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/marketing/sections/SectionRenderer', () => ({ default: ({ section }: { section: { content: { title?: string } } }) => <section>{section.content.title}</section> }));
afterEach(() => { cleanup(); sections.data = undefined; });

it('shows homepage content before the database responds', () => {
  render(<MarketingHome />);
  expect(screen.getByText('The operating system')).toBeInTheDocument();
  expect(screen.getByText('From signup to first order the same day')).toBeInTheDocument();
});

it('replaces defaults with saved content and respects disabled sections', () => {
  const { rerender } = render(<MarketingHome />);
  sections.data = [
    { id: 'hero', section_type: 'hero', is_enabled: true, content: { title: 'Custom homepage' } },
    { id: 'hidden', section_type: 'hero', is_enabled: false, content: { title: 'Hidden content' } },
  ];
  rerender(<MarketingHome />);
  expect(screen.getByText('Custom homepage')).toBeInTheDocument();
  expect(screen.queryByText('The operating system')).not.toBeInTheDocument();
  expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
});
