import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
const token = randomBytes(6).toString('hex');
const adminEmail = `billing-ui-admin-${token}@example.com`;
const ownerEmail = `billing-ui-owner-${token}@example.com`;
const password = randomBytes(18).toString('base64url');
const restaurantName = `Billing test ${token}`;
const methodName = `Test wallet ${token}`;
let backend: SupabaseClient, administrator: SupabaseClient, owner: SupabaseClient;
let apiUrl: string, anonKey: string, adminId: string, ownerId: string, restaurantId: string, providerId: string;
const paymentIds: string[] = [];
const transactions = [`APPROVE_${token}`, `REJECT_${token}`, `INVALID_${token}`];
async function reviewAs(client: SupabaseClient, paymentId: string, decision: string) {
  const { data } = await client.auth.getSession();
  return fetch(apiUrl + '/rest/v1/rpc/review_subscription_payment', { method: 'POST', headers: { apikey: anonKey, Authorization: 'Bearer ' + data.session?.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_payment_id: paymentId, p_decision: decision, p_notes: 'Automated local test' }) });
}
test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  apiUrl = env.API_URL; anonKey = env.ANON_KEY;
  if (!['127.0.0.1', 'localhost'].includes(new URL(apiUrl).hostname)) throw new Error('Local only');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  backend = createClient(apiUrl, env.SERVICE_ROLE_KEY, options); administrator = createClient(apiUrl, anonKey, options); owner = createClient(apiUrl, anonKey, options);
  const { data: user, error } = await backend.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
  if (error || !user.user) throw error ?? new Error('Missing administrator'); adminId = user.user.id;
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO public.platform_admins(email, notes) VALUES ('${adminEmail}', 'Disposable billing test');`], { stdio: ['ignore', 'pipe', 'pipe'] });
  await administrator.auth.signInWithPassword({ email: adminEmail, password });
  const { data: created, error: createError } = await owner.functions.invoke('restaurant-signup', { body: { restaurantName, slug: `billing-${token}`, ownerEmail, ownerPassword: password } });
  if (createError) throw new Error(await createError.context.text()); restaurantId = created.restaurant.id; ownerId = created.ownerId;
  const { error: ownerError } = await owner.auth.signInWithPassword({ email: ownerEmail, password }); if (ownerError) throw ownerError;
  const { error: planError } = await administrator.functions.invoke('platform-manage-tenant', { body: { action: 'change_plan', tenantId: restaurantId, plan: 'quarterly', status: 'active', currentPeriodEnd: '2027-01-11T00:00:00Z' } });
  if (planError) throw new Error(await planError.context.text());
  for (let index = 0; index < transactions.length; index++) {
    const { data, error } = await owner.from('subscription_payments').insert({ restaurant_id: restaurantId, submitted_by: ownerId, plan: index === 2 ? `unavailable-${token}` : 'quarterly', amount: 944, currency: 'BDT', billing_cycle: 'monthly', payment_method: 'bkash', sender_number: '01800000000', transaction_id: transactions[index] }).select('id').single();
    if (error) throw error; paymentIds.push(data.id);
  }
});
test.afterAll(async () => {
  if (providerId) { const { error } = await administrator.from('mobile_payment_settings').delete().eq('id', providerId); if (error) throw error; }
  if (restaurantId) {
    if (!/^[a-f0-9-]{36}$/.test(restaurantId)) throw new Error('Invalid UUID');
    execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.restaurants WHERE id='${restaurantId}'::uuid;`], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.platform_admins WHERE email='${adminEmail}';`], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (const id of [ownerId, adminId].filter(Boolean)) { const { error } = await backend.auth.admin.deleteUser(id); if (error) throw error; }
});

test('clear sections, payment review, exact subscription dates, payment-method setup and mobile layout', async ({ page }) => {
  await page.goto('/platform/login'); await page.getByLabel('Email', { exact: true }).fill(adminEmail); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /Sign in/ }).click(); await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/billing'); await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Subscriptions', exact: true })).toHaveAttribute('data-state', 'active');
  await page.getByLabel('Search subscriptions').fill(token); await expect(page.getByRole('article', { name: restaurantName })).toContainText('3 Months Plan');
  await page.screenshot({ path: '/tmp/breezy-billing-desktop.png', fullPage: true });
  await page.getByRole('tab', { name: /Payments/ }).click(); await page.getByLabel('Search payments').fill(transactions[0]);
  await page.getByRole('button', { name: `Review payment ${transactions[0]}` }).click(); let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Approve payment', exact: true })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'I verified this transaction' }).check(); await dialog.getByRole('button', { name: 'Approve payment', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  const { data: period, error: periodError } = await administrator.from('subscriptions').select('current_period_end').eq('restaurant_id', restaurantId).single();
  expect(periodError).toBeNull(); expect(Date.parse(period!.current_period_end!)).toBe(Date.parse('2027-04-11T00:00:00Z'));
  await page.getByLabel('Search payments').fill(transactions[1]); await page.getByRole('button', { name: `Review payment ${transactions[1]}` }).click(); dialog = page.getByRole('dialog');
  await dialog.getByLabel('Payment decision').selectOption('rejected'); await expect(dialog.getByRole('button', { name: 'Reject payment', exact: true })).toBeDisabled();
  await dialog.getByLabel('Reason for rejection').fill('Automated test: transaction not verified'); await dialog.getByRole('button', { name: 'Reject payment', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Payment status filter').selectOption('rejected'); await expect(page.getByRole('article', { name: `Payment ${transactions[1]}` })).toContainText('Rejected');
  await page.getByRole('tab', { name: 'Subscriptions', exact: true }).click(); await page.getByRole('button', { name: `Edit subscription for ${restaurantName}` }).click(); dialog = page.getByRole('dialog');
  await dialog.getByLabel('Subscription package').selectOption('biannual'); await dialog.getByLabel('Subscription expiry').fill('2027-07-17T12:34'); await dialog.getByRole('button', { name: 'Save subscription', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('article', { name: restaurantName })).toContainText('6 Months Plan');
  await page.getByRole('button', { name: `Edit subscription for ${restaurantName}` }).click(); await expect(page.getByRole('dialog').getByLabel('Subscription expiry')).toHaveValue('2027-07-17T12:34'); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: 'Payment methods', exact: true }).click(); await expect(page).toHaveURL(/tab=settings/);
  await page.getByRole('button', { name: 'Add payment method', exact: true }).click(); dialog = page.getByRole('dialog');
  await dialog.getByLabel('Payment provider').selectOption('custom'); await dialog.getByLabel('Payment method name').fill(methodName); await dialog.getByLabel('Receiver wallet number').fill('01800000000');
  const create = page.waitForResponse(response => response.url().includes('/rest/v1/mobile_payment_settings') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Save payment method', exact: true }).click(); const result = await create; const body = await result.json(); expect(result.ok(), JSON.stringify(body)).toBe(true); providerId = body.id;
  await expect(page.getByRole('article', { name: methodName })).toContainText('Disabled');
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: `Edit ${methodName}` }).click(); await expect(page.getByRole('dialog').getByRole('button', { name: 'Save payment method' })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: `Remove ${methodName}` }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Remove payment method', exact: true }).click(); await expect(page.getByRole('article', { name: methodName })).toHaveCount(0);
});

test('payment review is atomic, cannot be repeated, and rejects non-administrators', async () => {
  const alreadyReviewed = await reviewAs(administrator, paymentIds[0], 'approved'); expect(alreadyReviewed.status).toBe(400);
  const invalid = await reviewAs(administrator, paymentIds[2], 'approved'); expect(invalid.status).toBe(400);
  const { data: untouched, error } = await administrator.from('subscription_payments').select('status, reviewed_at').eq('id', paymentIds[2]).single(); expect(error).toBeNull(); expect(untouched).toEqual({ status: 'pending', reviewed_at: null });
  const forbidden = await reviewAs(owner, paymentIds[2], 'approved'); expect(forbidden.status).toBe(403);
});
