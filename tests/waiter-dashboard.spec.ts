import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

test.describe.configure({ mode: 'serial', timeout: 90_000 });
const token = randomBytes(6).toString('hex');
const email = `waiter-design-${token}@example.com`, password = randomBytes(18).toString('hex');
const tenant = randomUUID(), category = randomUUID(), meal = randomUUID(), table = randomUUID();
let backend: SupabaseClient, userId: string;
const sql = (statement: string) => execFileSync('docker', ['exec', '-i', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['localhost', '127.0.0.1'].includes(new URL(env.API_URL).hostname)) throw new Error('Local fixtures only');
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await backend.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error || !result.data.user) throw result.error ?? new Error('Missing fixture user');
  userId = result.data.user.id;
  sql(`BEGIN;
    INSERT INTO restaurants(id,name,slug) VALUES('${tenant}','The Olive Table','waiter-design-${token}');
    INSERT INTO restaurant_members(user_id,restaurant_id,role) VALUES('${userId}','${tenant}','waiter');
    DELETE FROM user_roles WHERE user_id='${userId}';
    INSERT INTO user_roles(user_id,role) VALUES('${userId}','waiter');
    UPDATE subscriptions SET plan='monthly',status='active',current_period_end=now()+interval '30 days' WHERE restaurant_id='${tenant}';
    UPDATE restaurant_settings SET restaurant_name='The Olive Table',tax_percentage=0 WHERE restaurant_id='${tenant}';
    INSERT INTO categories(id,name,restaurant_id) VALUES('${category}','Lunch','${tenant}');
    INSERT INTO menu_items(id,name,price,category_id,restaurant_id,is_available) VALUES('${meal}','Grilled chicken with garden vegetables',320,'${category}','${tenant}',true);
    INSERT INTO restaurant_tables(id,label,restaurant_id) VALUES('${table}','Table 08','${tenant}');
    ${['ready','preparing','pending','confirmed','served'].map((status, index) => {
      const order = randomUUID();
      return `INSERT INTO orders(id,user_id,restaurant_id,table_id,notes,created_at) VALUES('${order}','${userId}','${tenant}',${index === 2 ? 'NULL' : `'${table}'`},'${status === 'ready' ? 'Peanut allergy — keep sauce separate' : `${status} design fixture`}',now()-interval '${20-index*3} minutes');
      INSERT INTO order_items(order_id,restaurant_id,menu_item_id,quantity,notes) VALUES('${order}','${tenant}','${meal}',${index%2+1},'No onions');
      UPDATE orders SET status='${status}' WHERE id='${order}';`;
    }).join('\n')}
    COMMIT;`);
});

test.afterAll(async () => {
  sql(`DELETE FROM restaurants WHERE id='${tenant}';`);
  if (userId) { const result = await backend.auth.admin.deleteUser(userId); if (result.error) throw result.error; }
});

test('waiter dashboard works on desktop and mobile', async ({ page }) => {
  await page.goto('/staff-login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/waiter$/, { timeout: 30_000 });
  await expect(page.getByText('Grilled chicken with garden vegetables').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 10_000 });
  await page.screenshot({ path: `/tmp/serveos-waiter-${process.env.WAITER_DESIGN_BASELINE ? 'before' : 'after'}-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `/tmp/serveos-waiter-${process.env.WAITER_DESIGN_BASELINE ? 'before' : 'after'}-mobile.png`, fullPage: true });
  if (process.env.WAITER_DESIGN_BASELINE) return;
  await expect(page.getByRole('heading', { name: 'Service overview' })).toBeVisible();
  await expect(page.getByText(/Peanut allergy — keep sauce separate/).first()).toBeVisible();
  const cards = page.locator('[data-order-id]');
  await expect(cards.first()).toHaveAttribute('data-order-status', 'ready');
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mute order sounds' }).click();
  await expect(page.getByRole('button', { name: 'Enable order sounds' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: /^Ready to serve/ }).click();
  await expect(cards).toHaveCount(1);
  await page.getByRole('button', { name: /^Active orders/ }).click();
  await page.getByRole('searchbox', { name: 'Search orders' }).fill('takeaway');
  await expect(cards).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Search orders' }).fill('not-an-existing-order');
  await expect(page.getByText('No matching orders', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).first().click();
  await expect(cards).toHaveCount(4);
  const first = cards.first();
  await first.getByRole('button', { name: /Show details/ }).click();
  await expect(first.getByRole('button', { name: /Hide details/ })).toHaveAttribute('aria-expanded', 'true');
  await first.getByRole('button', { name: 'Mark Served', exact: true }).click();
  await expect(cards).toHaveCount(3);
  await page.getByRole('button', { name: /^Served/ }).click();
  await expect(cards).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: '/tmp/serveos-waiter-after-dark-mobile.png', fullPage: true });
});

test('failed order requests show a retry state instead of an empty floor', async ({ page }) => {
  await page.route('**/rest/v1/orders?**', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'XX000', message: 'Test connection failure' }) }));
  await page.goto('/staff-login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/waiter$/, { timeout: 30_000 });
  await expect(page.getByRole('status', { name: 'Loading orders' })).toBeVisible();
  await expect(page.getByText('Couldn’t load orders', { exact: true })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText('You’re all caught up', { exact: true })).toHaveCount(0);
  await page.unroute('**/rest/v1/orders?**');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('[data-order-id]').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Couldn’t load orders', { exact: true })).toHaveCount(0);
});
