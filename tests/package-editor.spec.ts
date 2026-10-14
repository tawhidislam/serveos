import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
let backend: SupabaseClient;
let administrator: SupabaseClient;
let adminId: string;
let packageId: string;
const email = `editor-${randomBytes(8).toString('hex')}@example.com`;
const password = randomBytes(18).toString('base64url');
const packageName = `Editor test ${randomBytes(4).toString('hex')}`;

test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('Local database only');
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  administrator = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await backend.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('No test user');
  adminId = data.user.id;
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO public.platform_admins(email, notes) VALUES ('${email}', 'Disposable editor test');`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const { error: authError } = await administrator.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
});
test.afterAll(async () => {
  if (packageId) {
    const { error } = await administrator.from('subscription_plans').delete().eq('id', packageId);
    if (error) throw error;
  }
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.platform_admins WHERE email = '${email}';`], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (adminId) { const { error } = await backend.auth.admin.deleteUser(adminId); if (error) throw error; }
});

test('creates, edits, previews and saves a package; discard protects saved prices', async ({ page }) => {
  await page.goto('/platform/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/packages');
  await expect(page.getByRole('heading', { name: 'Packages', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Monthly Plan' })).toContainText('৳349');
  await page.screenshot({ path: '/tmp/breezy-package-overview.png', fullPage: true });
  await page.getByRole('button', { name: 'New package', exact: true }).click();
  let editor = page.getByRole('dialog');
  await editor.getByLabel('Package name', { exact: true }).fill(packageName);
  await editor.getByLabel('Package price', { exact: true }).fill('99');
  await editor.getByLabel('Original price (optional)').fill('199');
  await editor.getByRole('switch', { name: 'Show on pricing page' }).click();
  const created = page.waitForResponse(response => response.url().includes('/rest/v1/subscription_plans') && response.request().method() === 'POST');
  await editor.getByRole('button', { name: 'Create package', exact: true }).click();
  const response = await created;
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBe(true);
  packageId = body.id;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: `Edit ${packageName}`, exact: true }).click();
  editor = page.getByRole('dialog');
  await editor.getByLabel('Package price', { exact: true }).fill('149');
  await expect(editor.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await expect(editor.getByRole('complementary')).toContainText('৳149');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('article', { name: packageName })).toContainText('৳99');
  await page.getByRole('button', { name: `Edit ${packageName}`, exact: true }).click();
  editor = page.getByRole('dialog');
  await editor.getByLabel('Package price', { exact: true }).fill('149');
  await editor.getByRole('tab', { name: 'Pricing card', exact: true }).click();
  await editor.getByLabel('Displayed features', { exact: true }).fill('Accounting suite\nFloor plans\nCustom domain');
  await page.screenshot({ path: '/tmp/breezy-package-editor.png', fullPage: true });
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('article', { name: packageName })).toContainText('৳149');
  await page.reload();
  await expect(page.getByRole('article', { name: packageName })).toContainText('৳149');
  const { data: saved, error } = await administrator.from('subscription_plans').select('price_monthly, prices').eq('id', packageId).single();
  expect(error).toBeNull();
  expect(saved?.price_monthly).toBe(149);
  expect((saved?.prices as { BDT: { monthly: number } }).BDT.monthly).toBe(149);
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: packageName, exact: true }).locator('..')).toContainText('৳149');
  await page.goto('/platform/packages');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: `Edit ${packageName}` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: `Edit ${packageName}` }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Save changes' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
