import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
const token = randomBytes(6).toString('hex');
const adminEmail = `tenant-ui-admin-${token}@example.com`;
const ownerEmail = `tenant-ui-owner-${token}@example.com`;
const password = randomBytes(18).toString('base64url');
const restaurantName = `Directory test ${token}`;
let backend: SupabaseClient;
let owner: SupabaseClient;
let adminId: string;
let ownerId: string;
let restaurantId: string;
test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('Local database only');
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  owner = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  const { data: user, error } = await backend.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
  if (error || !user.user) throw error ?? new Error('No test administrator');
  adminId = user.user.id;
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO public.platform_admins(email, notes) VALUES ('${adminEmail}', 'Disposable directory test');`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const { data: created, error: creationError } = await owner.functions.invoke('restaurant-signup', { body: { restaurantName, slug: `directory-${token}`, ownerEmail, ownerPassword: password } });
  if (creationError) throw new Error(await creationError.context.text());
  restaurantId = created.restaurant.id; ownerId = created.ownerId;
  const { error: signError } = await owner.auth.signInWithPassword({ email: ownerEmail, password });
  if (signError) throw signError;
  const { error: setupError } = await owner.functions.invoke('tenant-onboard', { body: {
    restaurantId, details: { cuisineType: 'Cafe', address: '123 Directory Test', currency: 'BDT' },
    menu: { template: 'cafe' }, tables: { count: 2 }, qr: { enabled: true },
  } });
  if (setupError) throw new Error(await setupError.context.text());
});
test.afterAll(async () => {
  if (restaurantId) {
    if (!/^[a-f0-9-]{36}$/.test(restaurantId)) throw new Error('Invalid test UUID');
    execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.restaurants WHERE id='${restaurantId}'::uuid;`], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.platform_admins WHERE email='${adminEmail}';`], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (const id of [ownerId, adminId].filter(Boolean)) { const { error } = await backend.auth.admin.deleteUser(id); if (error) throw error; }
});

test('searches, filters, manages current packages, suspends, reactivates and confirms deletion', async ({ page }) => {
  await page.goto('/platform/login');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/tenants');
  await expect(page.getByRole('heading', { name: 'Restaurants', exact: true })).toBeVisible();
  await page.getByLabel('Search restaurants').fill(token);
  await expect(page.getByRole('article')).toHaveCount(1);
  const row = page.getByRole('article', { name: restaurantName });
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: `Manage ${restaurantName}` }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Package', { exact: true }).click();
  await page.getByRole('option', { name: '3 Months Plan', exact: true }).click();
  await dialog.getByLabel('Subscription expiry').fill('2027-01-11T12:00');
  const update = page.waitForResponse(response => response.url().includes('/functions/v1/platform-manage-tenant') && response.request().postDataJSON().action === 'change_plan');
  await dialog.getByRole('button', { name: 'Save subscription' }).click();
  const response = await update;
  expect(response.ok(), await response.text()).toBe(true);
  await dialog.getByLabel('Management section').selectOption('members');
  await expect(dialog.getByText(ownerEmail, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(row).toContainText('3 Months Plan');
  await page.getByLabel('Package filter').selectOption('quarterly');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: `More actions for ${restaurantName}` }).click();
  await page.getByRole('menuitem', { name: 'Suspend restaurant' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Suspend restaurant' }).click();
  await expect(row.getByText('Suspended', { exact: true })).toBeVisible();
  await page.getByLabel('Restaurant status').selectOption('active');
  await expect(page.getByText('No matching restaurants')).toBeVisible();
  await page.getByLabel('Restaurant status').selectOption('suspended');
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: `More actions for ${restaurantName}` }).click();
  await page.getByRole('menuitem', { name: 'Reactivate restaurant' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reactivate restaurant' }).click();
  await expect(page.getByText('No matching restaurants')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).last().click();
  await page.screenshot({ path: '/tmp/breezy-tenants-desktop.png', fullPage: true });
  await page.getByRole('button', { name: `More actions for ${restaurantName}` }).click();
  await page.getByRole('menuitem', { name: 'View as owner' }).click();
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByRole('heading', { name: restaurantName, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page).toHaveURL(/\/platform\/tenants$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: `Manage ${restaurantName}` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: `More actions for ${restaurantName}` }).click();
  await page.getByRole('menuitem', { name: 'Delete restaurant' }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation.getByRole('button', { name: 'Delete restaurant' })).toBeDisabled();
  await confirmation.getByLabel('Restaurant name to confirm deletion').fill(restaurantName);
  await confirmation.getByRole('button', { name: 'Delete restaurant' }).click();
  await expect(row).toHaveCount(0);
});

test('restaurant owners cannot use platform management actions', async () => {
  for (const body of [
    { action: 'set_active', tenantId: restaurantId, isActive: false },
    { action: 'change_plan', tenantId: restaurantId, plan: 'quarterly' },
    { action: 'delete_tenant', tenantId: restaurantId },
  ]) {
    const { error } = await owner.functions.invoke('platform-manage-tenant', { body });
    expect(error?.context.status).toBe(403);
  }
});
