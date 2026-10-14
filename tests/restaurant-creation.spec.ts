import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
let backend: SupabaseClient;
let publicClient: SupabaseClient;
let url: string;
let anonKey: string;
const testAdmins: { id: string; email: string }[] = [];
const created: { id: string; ownerId: string }[] = [];
const credentials = () => ({ email: `flow-${randomBytes(8).toString('hex')}@example.com`, password: randomBytes(18).toString('base64url') });
const bodyFor = (email: string, password: string, slug?: string) => ({ restaurantName: 'Flow test restaurant', ownerEmail: email, ownerPassword: password, ...(slug ? { slug } : {}) });
const setupBody = (restaurantId: string) => ({
  restaurantId, details: { cuisineType: 'Cafe', address: '123 Test Street', currency: 'USD', taxPercentage: 10 },
  menu: { template: 'cafe' }, tables: { count: 3, defaultCapacity: 4, prefix: 'T' }, qr: { template: 'classic', enabled: true },
});
async function signup(slug?: string) {
  const login = credentials();
  const { data, error } = await publicClient.functions.invoke('restaurant-signup', { body: bodyFor(login.email, login.password, slug) });
  if (error) throw new Error(await error.context.text());
  created.push({ id: data.restaurant.id, ownerId: data.ownerId });
  const owner = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: authError } = await owner.auth.signInWithPassword(login);
  expect(authError).toBeNull();
  return { ...login, owner, ...data };
}
async function responseStatus(client: SupabaseClient, functionName: string, body: unknown) {
  const { data, error } = await client.functions.invoke(functionName, { body });
  return { data, status: error?.context?.status ?? 200, error };
}
test.beforeAll(() => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  url = env.API_URL;
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('These tests must only run against local Supabase');
  anonKey = env.ANON_KEY;
  backend = createClient(url, env.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
});
test.afterAll(async () => {
  for (const admin of testAdmins) {
    if (!/^flow-[a-f0-9]+@example\.com$/.test(admin.email)) throw new Error('Invalid test admin email');
    execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.platform_admins WHERE email = '${admin.email}';`], { stdio: ['ignore', 'pipe', 'pipe'] });
    const { error } = await backend.auth.admin.deleteUser(admin.id);
    if (error) throw error;
  }
  for (const tenant of created) {
    if (!/^[0-9a-f-]{36}$/.test(tenant.id)) throw new Error('Invalid test tenant UUID');
    execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.restaurants WHERE id = '${tenant.id}'::uuid;`], { stdio: ['ignore', 'pipe', 'pipe'] });
    const { error } = await backend.auth.admin.deleteUser(tenant.ownerId);
    if (error) throw error;
  }
});

test('browser signup waits for roles and completes onboarding with the requested public URL', async ({ page }) => {
  const login = credentials();
  const slug = `chosen-${randomBytes(5).toString('hex')}`;
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  // Slow the role request to reproduce the original protected-route race.
  await page.route('**/rest/v1/user_roles?*', async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto('/signup');
  await page.getByLabel('Restaurant name').fill('Browser restaurant');
  await page.getByLabel('Public URL').fill(slug);
  await page.getByLabel('Email', { exact: true }).fill(login.email);
  await page.getByLabel('Password', { exact: true }).fill(login.password);
  const signupResponse = page.waitForResponse(response => response.url().includes('/functions/v1/restaurant-signup'));
  await page.getByRole('button', { name: 'Create restaurant', exact: true }).click();
  const response = await signupResponse;
  const result = await response.json();
  expect(response.status(), JSON.stringify(result)).toBe(200);
  created.push({ id: result.restaurant.id, ownerId: result.ownerId });
  expect(result.restaurant.slug).toBe(slug);
  await expect(page).toHaveURL(/\/owner\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Browser restaurant' })).toBeVisible();
  await page.getByLabel('Cuisine Type').fill('Cafe');
  await page.getByLabel('Address').fill('123 Test Street');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const finishResponse = page.waitForResponse(response => response.url().includes('/functions/v1/tenant-onboard'));
  await page.getByRole('button', { name: 'Finish setup' }).click();
  const finish = await finishResponse;
  const finished = await finish.json();
  expect(finish.status(), JSON.stringify(finished)).toBe(200);
  expect(finished.menuCreated).toBe(9);
  expect(finished.tablesCreated).toBe(8);
  await expect(page).toHaveURL(/\/owner$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Browser restaurant', exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('rejects duplicate URLs, duplicate emails, reserved URLs and malformed input', async () => {
  const slug = `unique-${randomBytes(5).toString('hex')}`;
  const first = await signup(slug);
  const duplicate = credentials();
  expect((await responseStatus(publicClient, 'restaurant-signup', bodyFor(duplicate.email, duplicate.password, slug))).status).toBe(409);
  expect((await responseStatus(publicClient, 'restaurant-signup', bodyFor(first.email, first.password, slug + '-other'))).status).toBe(409);
  expect((await responseStatus(publicClient, 'restaurant-signup', bodyFor(duplicate.email, duplicate.password, 'admin'))).status).toBe(400);
  expect((await responseStatus(publicClient, 'restaurant-signup', { restaurantName: 123 })).status).toBe(400);
  const { data: users, error } = await backend.auth.admin.listUsers();
  expect(error).toBeNull();
  expect(users?.users.some(user => user.email === duplicate.email)).toBe(false);
});

test('onboarding is atomic, idempotent and isolated from other tenants', async () => {
  const first = await signup(`atomic-${randomBytes(5).toString('hex')}`);
  const second = await signup(`other-${randomBytes(5).toString('hex')}`);
  // Force a failure after inserting a category: every insert must roll back.
  const { error: failure } = await backend.rpc('provision_restaurant_onboarding', {
    p_restaurant_id: first.restaurant.id, p_actor_id: first.ownerId,
    p_details: setupBody(first.restaurant.id).details,
    p_groups: [{ category: 'Rollback test', items: [{ name: 'Invalid item', price: null }] }],
    p_tables: { count: 3 }, p_qr: {},
  });
  expect(failure).not.toBeNull();
  const { data: categories, error: readError } = await first.owner.from('categories').select('id').eq('restaurant_id', first.restaurant.id);
  expect(readError).toBeNull();
  expect(categories).toEqual([]);
  const { data: before } = await first.owner.from('restaurants').select('onboarding_completed').eq('id', first.restaurant.id).single();
  expect(before?.onboarding_completed).toBe(false);
  expect((await responseStatus(second.owner, 'tenant-onboard', setupBody(first.restaurant.id))).status).toBe(403);
  const invalid = setupBody(first.restaurant.id);
  invalid.tables.count = 1.5;
  expect((await responseStatus(first.owner, 'tenant-onboard', invalid)).status).toBe(400);
  const [a, b] = await Promise.all([
    responseStatus(first.owner, 'tenant-onboard', setupBody(first.restaurant.id)),
    responseStatus(first.owner, 'tenant-onboard', setupBody(first.restaurant.id)),
  ]);
  expect([a.status, b.status]).toEqual([200, 200]);
  expect(a.data.menuCreated + b.data.menuCreated).toBe(9);
  expect(a.data.tablesCreated + b.data.tablesCreated).toBe(3);
  const { data: tables, error: tableError } = await first.owner.from('restaurant_tables').select('id').eq('restaurant_id', first.restaurant.id);
  expect(tableError).toBeNull();
  expect(tables).toHaveLength(3);
  const { error: forbiddenRpc } = await first.owner.rpc('provision_restaurant_onboarding', {
    p_restaurant_id: first.restaurant.id, p_actor_id: first.ownerId,
    p_details: {}, p_groups: [], p_tables: {}, p_qr: {},
  });
  expect(forbiddenRpc).not.toBeNull();
});

test('platform console creates a tenant and rejects reusing a linked owner', async ({ page }) => {
  const login = credentials();
  const { data: adminAccount, error } = await backend.auth.admin.createUser({ ...login, email_confirm: true });
  expect(error).toBeNull();
  if (!adminAccount.user) throw new Error('No test admin');
  testAdmins.push({ id: adminAccount.user.id, email: login.email });
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO public.platform_admins(email, notes) VALUES ('${login.email}', 'Disposable flow test');`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const ownerLogin = credentials();
  const slug = `platform-${randomBytes(5).toString('hex')}`;
  await page.goto('/platform/login');
  await page.getByLabel('Email', { exact: true }).fill(login.email);
  await page.getByLabel('Password', { exact: true }).fill(login.password);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/tenants');
  await page.getByRole('button', { name: 'Add restaurant' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Restaurant name').fill('Platform browser tenant');
  await dialog.getByLabel('URL slug').fill(slug);
  await dialog.getByLabel('Owner email').fill(ownerLogin.email);
  await dialog.getByLabel('Temporary password').fill(ownerLogin.password);
  const creation = page.waitForResponse(response => response.url().includes('/functions/v1/platform-create-tenant'));
  await dialog.getByRole('button', { name: 'Create restaurant' }).click();
  const response = await creation;
  const result = await response.json();
  expect(response.status(), JSON.stringify(result)).toBe(200);
  created.push({ id: result.restaurant.id, ownerId: result.ownerId });
  await expect(page.getByText('Platform browser tenant', { exact: true })).toBeVisible();
  const platform = createClient(url, anonKey, { auth: { persistSession: false } });
  await platform.auth.signInWithPassword(login);
  expect((await responseStatus(platform, 'platform-create-tenant', bodyFor(ownerLogin.email, ownerLogin.password, slug + '-second'))).status).toBe(409);
  expect((await responseStatus(publicClient, 'platform-create-tenant', bodyFor(ownerLogin.email, ownerLogin.password, slug + '-unauthorized'))).status).toBe(403);
});

test('keeps the selected plan through failed automatic sign-in and onboarding', async ({ page }) => {
  const login = credentials();
  await page.route('**/auth/v1/token?*', async route => {
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Test automatic sign-in failure' }) });
  }, { times: 1 });
  await page.goto('/signup?plan=pro&cycle=monthly');
  await page.getByLabel('Restaurant name').fill('Checkout flow');
  await page.getByLabel('Public URL').fill(`checkout-${randomBytes(5).toString('hex')}`);
  await page.getByLabel('Email', { exact: true }).fill(login.email);
  await page.getByLabel('Password', { exact: true }).fill(login.password);
  const creation = page.waitForResponse(response => response.url().includes('/functions/v1/restaurant-signup'));
  await page.getByRole('button', { name: 'Create restaurant', exact: true }).click();
  const response = await creation;
  const result = await response.json();
  expect(response.status(), JSON.stringify(result)).toBe(200);
  created.push({ id: result.restaurant.id, ownerId: result.ownerId });
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(login.email);
  await page.getByLabel('Password', { exact: true }).fill(login.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/owner\/onboarding\?next=/);
  await page.getByLabel('Cuisine Type').fill('Cafe');
  await page.getByLabel('Address').fill('456 Test Street');
  for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page).toHaveURL(/\/admin\/subscription\?plan=pro&cycle=monthly$/);
});
