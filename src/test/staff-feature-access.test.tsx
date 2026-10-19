import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { usePlan } from '@/hooks/usePlan';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import FeatureGate from '@/components/FeatureGate';
import { fetchRestaurantSubscription } from '@/lib/restaurant-subscription';

vi.mock('@/lib/restaurant-subscription', () => ({ fetchRestaurantSubscription: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ hasAnyRole: () => false }) }));
vi.mock('@/hooks/usePlatformAdmin', () => ({ usePlatformAdmin: () => ({ isPlatformAdmin: false }) }));
vi.mock('@/hooks/useCurrentRestaurant', () => ({ useCurrentRestaurant: () => ({ data: { id: 'staff-restaurant' } }) }));
vi.mock('@/hooks/useSubscriptionPlans', () => ({ useSubscriptionPlans: () => ({ data: [] }), findPlanByTier: () => undefined }));
vi.mock('@/hooks/useAddons', () => ({
  useActiveAddonFeatureKeys: () => new Set(),
  useActiveAddonQuantityBoosts: () => ({ extraMenuItems: 0, extraBranches: 0, extraStaff: 0, unlimitedMenuItems: false, unlimitedBranches: false, unlimitedStaff: false }),
}));

let client: QueryClient;
const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();
function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>;
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchRestaurantSubscription).mockReset();
});
afterEach(() => { cleanup(); client.clear(); });

describe('staff subscription checks', () => {
  it.each([
    { plan: 'monthly', status: 'active', current_period_end: future, allowed: true, expired: false },
    { plan: 'trial', status: 'trialing', current_period_end: future, allowed: true, expired: false },
    { plan: 'free', status: 'active', current_period_end: null, allowed: false, expired: false },
    { plan: 'monthly', status: 'active', current_period_end: past, allowed: false, expired: true },
    { plan: 'monthly', status: 'canceled', current_period_end: future, allowed: false, expired: true },
  ])('resolves $plan/$status operations access without reading billing records', async ({ allowed, expired, ...subscription }) => {
    vi.mocked(fetchRestaurantSubscription).mockResolvedValue(subscription);
    const { result } = renderHook(() => ({ plan: usePlan(), status: useSubscriptionStatus() }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.plan.isSuccess && result.current.status.isSuccess).toBe(true));
    expect(result.current.plan.data?.limits.operations).toBe(allowed);
    expect(result.current.status.data?.isExpired).toBe(expired);
    expect(fetchRestaurantSubscription).toHaveBeenCalledWith('staff-restaurant');
  });

  it('opens POS for an active staff subscription', async () => {
    vi.mocked(fetchRestaurantSubscription).mockResolvedValue({ plan: 'monthly', status: 'active', current_period_end: future });
    render(<FeatureGate feature="operations" featureName="POS"><p>Staff POS workspace</p></FeatureGate>, { wrapper: Wrapper });
    await screen.findByText('Staff POS workspace');
    expect(screen.queryByText('POS is locked')).not.toBeInTheDocument();
  });

  it('shows a retry message when access cannot be loaded, instead of claiming an upgrade is needed', async () => {
    vi.mocked(fetchRestaurantSubscription).mockRejectedValue(new Error('Network unavailable'));
    render(<FeatureGate feature="operations" featureName="POS"><p>Staff POS workspace</p></FeatureGate>, { wrapper: Wrapper });
    await screen.findByRole('alert');
    expect(screen.getByText('Could not check feature access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('POS is locked')).not.toBeInTheDocument();
    expect(screen.queryByText('Staff POS workspace')).not.toBeInTheDocument();
  });

  it('asks staff to contact their owner when a feature is actually unavailable', async () => {
    vi.mocked(fetchRestaurantSubscription).mockResolvedValue({ plan: 'free', status: 'active', current_period_end: null });
    render(<FeatureGate feature="operations" featureName="POS"><p>Staff POS workspace</p></FeatureGate>, { wrapper: Wrapper });
    await screen.findByText('POS is locked');
    expect(screen.getByText(/Ask your restaurant owner or manager to check/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View plans' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes staff POS when an expiry refresh arrives before the cached plan refreshes', async () => {
    vi.mocked(fetchRestaurantSubscription).mockResolvedValue({ plan: 'monthly', status: 'active', current_period_end: future });
    render(<FeatureGate feature="operations" featureName="POS"><p>Staff POS workspace</p></FeatureGate>, { wrapper: Wrapper });
    await screen.findByText('Staff POS workspace');
    vi.mocked(fetchRestaurantSubscription).mockResolvedValue({ plan: 'monthly', status: 'expired', current_period_end: past });
    await act(async () => { await client.invalidateQueries({ queryKey: ['subscription-status'] }); });
    await screen.findByText('Restaurant subscription expired');
    expect(screen.queryByText('Staff POS workspace')).not.toBeInTheDocument();
  });
});
