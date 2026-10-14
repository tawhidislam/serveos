import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarketingNav from '@/components/marketing/MarketingNav';

vi.mock('@/components/marketing/PlatformLogo', () => ({ default: () => <span>ServeOS</span> }));
vi.mock('@/components/marketing/CurrencySwitcher', () => ({ default: () => null }));
vi.mock('@/lib/marketing-prefetch', () => ({ prefetchHandlers: () => ({}) }));
afterEach(cleanup);

it('closes the mobile menu when the current page is selected and releases scroll', () => {
  render(<MemoryRouter initialEntries={['/pricing']}><MarketingNav /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  const menu = screen.getByRole('dialog', { name: 'Navigation' });
  expect(document.body).toHaveAttribute('data-scroll-locked');
  fireEvent.click(within(menu).getByRole('link', { name: 'Pricing' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body).not.toHaveAttribute('data-scroll-locked');
});

it('supports Escape and exposes calls to action as links without nested buttons', () => {
  render(<MemoryRouter><MarketingNav /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  const menu = screen.getByRole('dialog');
  expect(within(menu).getByRole('link', { name: 'Get started' }).querySelector('button')).toBeNull();
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
