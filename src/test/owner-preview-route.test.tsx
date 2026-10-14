import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';

const state = vi.hoisted(() => ({ platformAdmin: false, active: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user' }, loading: false, hasAnyRole: () => false }) }));
vi.mock('@/hooks/usePlatformAdmin', () => ({ usePlatformAdmin: () => ({ isPlatformAdmin: state.platformAdmin, loading: false }) }));
vi.mock('@/hooks/useImpersonation', () => ({ useImpersonation: () => ({ active: state.active ? { restaurantId: 'test-restaurant' } : null, isSwitching: false }) }));
afterEach(() => { cleanup(); state.platformAdmin = false; state.active = true; });
function showRoute() {
  render(<MemoryRouter initialEntries={['/owner']}><Routes><Route path="/" element={<p>Home</p>} /><Route path="/owner" element={<ProtectedRoute allowedRoles={['owner']}><p>Owner dashboard</p></ProtectedRoute>} /></Routes></MemoryRouter>);
}
it('does not allow a regular account to fake owner preview state', () => {
  showRoute();
  expect(screen.getByText('Home')).toBeInTheDocument();
  expect(screen.queryByText('Owner dashboard')).not.toBeInTheDocument();
});
it('allows a verified platform admin to open the selected owner preview', () => {
  state.platformAdmin = true;
  showRoute();
  expect(screen.getByText('Owner dashboard')).toBeInTheDocument();
});
it('requires an active preview even for a platform admin without an owner role', () => {
  state.platformAdmin = true; state.active = false;
  showRoute();
  expect(screen.getByText('Home')).toBeInTheDocument();
});
