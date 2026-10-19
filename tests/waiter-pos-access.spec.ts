import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

test.describe.configure({ mode: 'serial', timeout: 60_000 });
const token = randomBytes(6).toString('hex');
const email = `waiter-pos-access-${token}@example.com`, password = randomBytes(18).toString('hex');
const restaurantId = randomUUID(), categoryId = randomUUID(), itemId = randomUUID();
const itemName = `Waiter POS item ${token}`;
let backend: SupabaseClient, userId: string;
function sql(statement: string) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['localhost', '127.0.0.1'].includes(new URL(env.API_URL).hostname)) throw new Error('Local fixtures only');
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await backend.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('Missing waiter test account');
  userId = data.user.id;
  sql(`BEGIN;
    INSERT INTO public.restaurants(id,name,slug) VALUES('${restaurantId}','Waiter POS regression','waiter-pos-access-${token}');
    INSERT INTO public.restaurant_members(user_id,restaurant_id,role) VALUES('${userId}','${restaurantId}','waiter');
    DELETE FROM public.user_roles WHERE user_id='${userId}';
    INSERT INTO public.user_roles(user_id,role) VALUES('${userId}','waiter');
    INSERT INTO public.categories(id,name,restaurant_id) VALUES('${categoryId}','POS access test','${restaurantId}');
    INSERT INTO public.menu_items(id,name,price,category_id,restaurant_id,is_available) VALUES('${itemId}','${itemName}',100,'${categoryId}','${restaurantId}',true);
    COMMIT;`);
});

test.afterAll(async () => {
  sql(`DELETE FROM public.restaurants WHERE id='${restaurantId}';`);
  if (userId) { const { error } = await backend.auth.admin.deleteUser(userId); if (error) throw error; }
});

for (const scenario of [
  { name: 'paid plan', plan: 'monthly', status: 'active', period: "now()+interval '30 days'", allowed: true },
  { name: 'seven-day trial', plan: 'trial', status: 'trialing', period: "(SELECT created_at+interval '7 days' FROM public.restaurants WHERE id=subscriptions.restaurant_id)", allowed: true },
  { name: 'free plan', plan: 'free', status: 'trialing', period: 'NULL', allowed: false },
  { name: 'expired subscription', plan: 'monthly', status: 'expired', period: "now()-interval '1 day'", allowed: false },
]) {
  test(`waiter POS respects the restaurant ${scenario.name}`, async ({ page }) => {
    sql(`UPDATE public.subscriptions SET plan='${scenario.plan}',status='${scenario.status}',current_period_end=${scenario.period} WHERE restaurant_id='${restaurantId}';`);
    await page.goto('/staff-login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    const signInResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/auth/v1/token'), { timeout: 25_000 });
    await page.getByRole('button', { name: /Sign in/i }).click();
    const response = await signInResponse;
    if (!response.ok()) {
      const error = await response.json();
      throw new Error(`Waiter sign-in failed (${response.status()}): ${error.msg ?? error.error_description ?? error.error ?? 'Authentication failed'}`);
    }
    await expect(page).toHaveURL(/\/waiter$/, { timeout: 25_000 });
    await page.getByRole('link', { name: 'POS', exact: true }).first().click();
    await expect(page).toHaveURL(/\/admin\/pos$/);
    if (scenario.allowed) {
      await expect(page.getByRole('heading', { name: 'Point of Sale', exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Waiter Panel', { exact: true }).first()).toBeVisible();
      await expect(page.getByText(itemName, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: 'POS is locked' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('heading', { name: scenario.status === 'expired' ? 'Restaurant subscription expired' : 'POS is locked', exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Ask your restaurant owner or manager/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'View plans' })).toHaveCount(0);
    }
  });
}
