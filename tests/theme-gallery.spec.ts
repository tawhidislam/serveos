import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
const suffix = randomBytes(6).toString('hex');
const adminEmail = `theme-ui-admin-${suffix}@example.com`;
const ownerEmail = `theme-ui-owner-${suffix}@example.com`;
const password = randomBytes(18).toString('base64url');
const restaurantName = `Theme test ${suffix}`;
const themeName = `Custom café ${suffix}`;
let backend: SupabaseClient;
let administrator: SupabaseClient;
let owner: SupabaseClient;
let anonymous: SupabaseClient;
let adminId: string;
let ownerId: string;
let restaurantId: string;
let themeId: string;

test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('Local database only');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options);
  administrator = createClient(env.API_URL, env.ANON_KEY, options);
  owner = createClient(env.API_URL, env.ANON_KEY, options);
  anonymous = createClient(env.API_URL, env.ANON_KEY, options);
  const { data: admin, error } = await backend.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
  if (error || !admin.user) throw error ?? new Error('Missing test admin');
  adminId = admin.user.id;
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO public.platform_admins(email, notes) VALUES ('${adminEmail}', 'Disposable theme test');`], { stdio: ['ignore', 'pipe', 'pipe'] });
  await administrator.auth.signInWithPassword({ email: adminEmail, password });
  const { data: created, error: createError } = await owner.functions.invoke('restaurant-signup', { body: { restaurantName, slug: `theme-${suffix}`, ownerEmail, ownerPassword: password } });
  if (createError) throw new Error(await createError.context.text());
  restaurantId = created.restaurant.id; ownerId = created.ownerId;
  const { error: signError } = await owner.auth.signInWithPassword({ email: ownerEmail, password });
  if (signError) throw signError;
  const { error: setupError } = await owner.functions.invoke('tenant-onboard', { body: {
    restaurantId, details: { cuisineType: 'Cafe', address: '123 Theme Test', currency: 'BDT' },
    menu: { template: 'cafe' }, tables: { count: 2 }, qr: { enabled: true },
  } });
  if (setupError) throw new Error(await setupError.context.text());
});
test.afterAll(async () => {
  if (restaurantId) {
    if (!/^[a-f0-9-]{36}$/.test(restaurantId)) throw new Error('Invalid test restaurant');
    execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.restaurants WHERE id='${restaurantId}'::uuid;`], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
  if (themeId) { const { error } = await administrator.from('platform_themes').delete().eq('id', themeId); if (error) throw error; }
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.platform_admins WHERE email='${adminEmail}';`], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (const id of [ownerId, adminId].filter(Boolean)) { const { error } = await backend.auth.admin.deleteUser(id); if (error) throw error; }
});

test('gallery previews, duplicates, edits and assigns a theme to the public restaurant', async ({ page, browser }) => {
  await page.goto('/platform/login');
  await page.getByLabel('Email', { exact: true }).fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/themes');
  await expect(page.getByRole('heading', { name: 'Themes', exact: true })).toBeVisible();
  for (const name of ['Midnight Amber', 'Garden Bistro', 'Terracotta Café', 'Coastal Blue', 'Ivory Minimal', 'Royal Plum']) await expect(page.getByRole('article', { name })).toBeVisible();
  await page.screenshot({ path: '/tmp/breezy-themes-gallery.png', fullPage: true });
  await page.getByLabel('Search themes').fill('terracotta');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Preview and apply Terracotta Café' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Apply theme' })).toBeDisabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'More actions for Terracotta Café' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate theme' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Theme name', { exact: true }).fill(themeName);
  await dialog.getByRole('tab', { name: 'Colors', exact: true }).click();
  await dialog.getByLabel('Accent color', { exact: true }).fill('#9C3150');
  await dialog.getByRole('tab', { name: 'Type & layout' }).click();
  await dialog.getByLabel('Heading font').selectOption('Georgia, serif');
  await page.screenshot({ path: '/tmp/breezy-theme-editor.png', fullPage: true });
  const create = page.waitForResponse(response => response.url().includes('/rest/v1/platform_themes') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Create theme', exact: true }).click();
  const creation = await create; const created = await creation.json();
  expect(creation.ok(), JSON.stringify(created)).toBe(true); themeId = created.id;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Search themes').fill(themeName);
  await expect(page.getByRole('article', { name: themeName })).toContainText('Inactive');
  const { data: hidden, error: hiddenError } = await anonymous.from('platform_themes').select('id').eq('id', themeId);
  expect(hiddenError).toBeNull(); expect(hidden).toEqual([]);
  await page.getByRole('button', { name: `Edit ${themeName}` }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('switch', { name: 'Available for assignment' }).click();
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: `Preview and apply ${themeName}` }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Apply to restaurant', { exact: true }).selectOption(restaurantId);
  await dialog.getByRole('button', { name: 'Apply theme', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('article', { name: themeName })).toContainText('Used by 1 restaurant');
  const context = await browser.newContext();
  const publicPage = await context.newPage();
  await publicPage.goto(`http://127.0.0.1:8080/r/theme-${suffix}`);
  await expect(publicPage.locator('[data-homepage-template="cafe"]')).toBeVisible();
  await expect(publicPage.locator('html')).toHaveAttribute('data-tenant-theme-key', new RegExp('copy'));
  await expect.poll(() => publicPage.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tmpl-accent').trim())).toBe('#9C3150');
  await page.getByRole('button', { name: `Edit ${themeName}` }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('switch', { name: 'Available for assignment' }).click();
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await publicPage.reload();
  await expect(publicPage.locator('html')).toHaveAttribute('data-tenant-theme-key', new RegExp('copy'));
  await publicPage.goto('http://127.0.0.1:8080/pricing');
  await expect(publicPage.locator('html')).not.toHaveAttribute('data-tenant-theme-key');
  await context.close();
  await page.getByRole('button', { name: `Edit ${themeName}` }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Theme name', { exact: true }).fill('Unsaved theme change');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByRole('article', { name: themeName })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: `Edit ${themeName}` }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Save changes' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('restaurant owners cannot write platform themes or assign them through platform tools', async () => {
  const { error: insertError } = await owner.from('platform_themes').insert({ key: `forbidden-${suffix}`, name: 'Must be rejected' });
  expect(insertError?.code).toBe('42501');
  const { error } = await owner.functions.invoke('platform-manage-tenant', { body: { action: 'assign_theme', tenantId: restaurantId, themeId } });
  expect(error?.context.status).toBe(403);
});
