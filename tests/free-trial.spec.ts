import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
const token = randomBytes(6).toString('hex');
const email = `trial-test-${token}@example.com`;
const password = randomBytes(18).toString('base64url');
const name = `Trial restaurant ${token}`;
let backend: SupabaseClient, owner: SupabaseClient;
let restaurantId: string, ownerId: string;
const sql = (statement: string) => execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', statement], { stdio: ['ignore', 'pipe', 'pipe'] });
test.beforeAll(() => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('Local only');
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } }); owner = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
});
test.afterAll(async () => {
  if (restaurantId) { if (!/^[a-f0-9-]{36}$/.test(restaurantId)) throw new Error('Invalid UUID'); sql(`DELETE FROM public.restaurants WHERE id='${restaurantId}'::uuid;`); }
  if (ownerId) { const { error } = await backend.auth.admin.deleteUser(ownerId); if (error) throw error; }
});

test('public signup automatically grants seven free days and trial operations access', async ({ page }) => {
  await page.goto('/pricing');
  const card = page.getByRole('heading', { name: '7-Day Free Trial', exact: true }).locator('..');
  await expect(card).toContainText('/ 7 days'); await expect(card.getByRole('link', { name: /Start free trial/ })).toHaveAttribute('href', '/signup');
  await card.getByRole('link', { name: /Start free trial/ }).click();
  await page.getByLabel('Restaurant name').fill(name); await page.getByLabel('Public URL').fill(`trial-${token}`); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
  const creation = page.waitForResponse(response => response.url().includes('/functions/v1/restaurant-signup'));
  await page.getByRole('button', { name: 'Create restaurant', exact: true }).click();
  const response = await creation; const created = await response.json(); expect(response.ok(), JSON.stringify(created)).toBe(true); restaurantId = created.restaurant.id; ownerId = created.ownerId;
  await owner.auth.signInWithPassword({ email, password });
  const { data: subscription, error } = await owner.from('subscriptions').select('plan, status, created_at, current_period_end').eq('restaurant_id', restaurantId).single();
  expect(error).toBeNull(); expect(subscription?.plan).toBe('trial'); expect(subscription?.status).toBe('trialing'); expect(Date.parse(subscription!.current_period_end!) - Date.parse(subscription!.created_at)).toBe(7 * 86400000);
  await expect(page).toHaveURL(/\/owner\/onboarding$/); await page.getByLabel('Cuisine Type').fill('Cafe'); await page.getByLabel('Address').fill('123 Trial Test'); for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Continue' }).click(); await page.getByRole('button', { name: 'Finish setup' }).click(); await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByText('7-day free trial', { exact: true })).toBeVisible(); await expect(page.getByText(/No automatic charge/)).toBeVisible();
  await page.goto('/admin/orders'); await expect(page).toHaveURL(/\/admin\/orders$/); await expect(page.getByText('7-day free trial', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/breezy-free-trial.png', fullPage: true });
});

test('trial expires, cannot restart through signup, blocks new orders and allows a paid upgrade', async ({ page }) => {
  expect(restaurantId).toBeTruthy();
  sql(`UPDATE public.subscriptions SET current_period_end=now()-interval '1 second' WHERE restaurant_id='${restaurantId}'::uuid;`);
  expect(() => sql(`UPDATE public.subscriptions SET current_period_end=created_at+interval '8 days' WHERE restaurant_id='${restaurantId}'::uuid;`)).toThrow();
  const { data: expired } = await owner.from('subscriptions').select('status').eq('restaurant_id', restaurantId).single(); expect(expired?.status).toBe('expired');
  const { data, error } = await owner.functions.invoke('restaurant-signup', { body: { restaurantName: name, slug: `repeat-${token}`, ownerEmail: email, ownerPassword: password } }); expect(error?.context.status).toBe(409); expect(data).toBeNull();
  await page.goto('/staff-login'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /Sign in/i }).click(); await expect(page).toHaveURL(/\/owner$/);
  await page.goto('/admin/orders'); await expect(page).toHaveURL(/\/admin\/subscription\/expired$/);
  let blocked = false;
  try { sql(`INSERT INTO public.orders(restaurant_id) VALUES ('${restaurantId}'::uuid);`); } catch (cause) { blocked = true; expect(String((cause as { stderr: Buffer }).stderr)).toContain('subscription has expired'); }
  expect(blocked).toBe(true);
  sql(`UPDATE public.subscriptions SET plan='monthly', status='active', current_period_end=now()+interval '1 month' WHERE restaurant_id='${restaurantId}'::uuid;`);
  await page.goto('/admin/orders'); await expect(page).toHaveURL(/\/admin\/orders$/); await expect(page.getByText('7-day free trial', { exact: true })).toHaveCount(0);
});
