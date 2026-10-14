import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
const token = randomBytes(6).toString('hex');
const adminEmail = `support-ui-admin-${token}@example.com`;
const visitorEmail = `support-ui-visitor-${token}@example.com`;
const password = randomBytes(18).toString('base64url');
const visitorName = `Inbox tester ${token}`;
let backend: SupabaseClient, administrator: SupabaseClient, visitor: SupabaseClient;
let adminId: string, visitorId: string, replyId: string;
const conversations: string[] = [];

test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('Local database only');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options); administrator = createClient(env.API_URL, env.ANON_KEY, options); visitor = createClient(env.API_URL, env.ANON_KEY, options);
  for (const email of [adminEmail, visitorEmail]) {
    const { data, error } = await backend.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error('Missing test user'); if (email === adminEmail) adminId = data.user.id; else visitorId = data.user.id;
  }
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO public.platform_admins(email, notes) VALUES ('${adminEmail}', 'Disposable support test');`], { stdio: ['ignore', 'pipe', 'pipe'] });
  await administrator.auth.signInWithPassword({ email: adminEmail, password }); await visitor.auth.signInWithPassword({ email: visitorEmail, password });
  for (const [index, subject] of ['Receipt printer question', 'Second conversation', 'Contact form question'].entries()) {
    const { data, error } = await backend.from('support_conversations').insert({ requester_user_id: visitorId, requester_kind: 'visitor', visitor_name: index === 1 ? `Second tester ${token}` : visitorName, visitor_email: visitorEmail, subject, category: 'technical', status: 'open', channel: index === 2 ? 'contact_form' : 'chat' }).select('id').single();
    if (error) throw error; conversations.push(data.id);
    const { error: messageError } = await backend.from('support_messages').insert({ conversation_id: data.id, sender_kind: 'requester', sender_user_id: visitorId, body: `Automated local test question ${index + 1}` });
    if (messageError) throw messageError;
  }
});
test.afterAll(async () => {
  for (const id of conversations) { const { error } = await backend.from('support_conversations').delete().eq('id', id); if (error) throw error; }
  if (replyId) { const { error } = await backend.from('support_saved_replies').delete().eq('id', replyId); if (error) throw error; }
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM public.platform_admins WHERE email='${adminEmail}';`], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (const id of [visitorId, adminId].filter(Boolean)) { const { error } = await backend.auth.admin.deleteUser(id); if (error) throw error; }
});

test('search, replies without realtime, private notes, assignment, resolution, details and mobile layout', async ({ page }) => {
  test.setTimeout(45000);
  // Replies should appear from the HTTP response even when live updates fail.
  await page.routeWebSocket('**/realtime/**', socket => socket.close());
  await page.goto('/platform/login'); await page.getByLabel('Email', { exact: true }).fill(adminEmail); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /Sign in/ }).click(); await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/support'); await expect(page.getByRole('heading', { name: 'Support', exact: true })).toBeVisible();
  await page.getByLabel('Search conversations').fill(token);
  await page.getByRole('button').filter({ hasText: 'Receipt printer question' }).click();
  await expect(page.getByLabel('Customer reply text')).toBeVisible();
  await page.screenshot({ path: '/tmp/breezy-support-inbox.png', fullPage: true });
  await page.getByLabel('Customer reply text').fill('First line'); await page.getByLabel('Customer reply text').press('Enter'); await page.getByLabel('Customer reply text').pressSequentially('Second line');
  const { count } = await administrator.from('support_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversations[0]).eq('sender_kind', 'agent'); expect(count).toBe(0);
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('First line Second line');
  await page.getByRole('button', { name: 'Internal note', exact: true }).click(); await page.getByLabel('Internal note text').fill('Private automated test note'); await page.getByRole('button', { name: 'Add private note', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Private automated test note');
  const { data: visible, error } = await visitor.from('support_messages').select('body').eq('conversation_id', conversations[0]); expect(error).toBeNull(); expect(visible?.some(message => message.body === 'Private automated test note')).toBe(false);
  await page.getByRole('button', { name: 'Assign to me', exact: true }).click(); await expect(page.getByRole('button', { name: 'Unassign me' })).toBeVisible();
  await page.getByRole('button', { name: 'Details', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Customer details' })).toContainText(visitorEmail); await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Customer reply', exact: true }).click(); await page.getByRole('button', { name: 'Resolve', exact: true }).click(); await expect(page.getByRole('button', { name: 'Reopen', exact: true })).toBeVisible(); await expect(page.getByLabel('Customer reply text')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reopen', exact: true }).click(); await expect(page.getByLabel('Customer reply text')).toBeVisible();
  await page.getByLabel('Customer reply text').fill('Retry test message');
  await page.route('**/rest/v1/support_messages*', route => route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Simulated test failure' }) }) : route.continue(), { times: 1 });
  await page.getByRole('button', { name: 'Send reply', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByLabel('Customer reply text')).toHaveValue('Retry test message');
  await page.getByRole('button', { name: 'Send reply', exact: true }).click(); await expect(page.getByRole('log')).toContainText('Retry test message');
  const { error: incomingError } = await visitor.from('support_messages').insert({ conversation_id: conversations[0], sender_kind: 'requester', sender_user_id: visitorId, body: 'New question while live updates are offline' });
  expect(incomingError).toBeNull();
  await expect(page.getByRole('button', { name: 'Refresh inbox', exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Refresh inbox', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('New question while live updates are offline');
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole('button', { name: 'Send reply', exact: true })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Back to conversations' }).click(); await expect(page.getByLabel('Search conversations')).toBeVisible();
});

test('saved replies, initialized settings, contact-form behavior and stale-selection protection', async ({ page }) => {
  await page.goto('/platform/login'); await page.getByLabel('Email', { exact: true }).fill(adminEmail); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: /Sign in/ }).click(); await expect(page).toHaveURL(/\/platform$/); await page.goto('/platform/support');
  await page.getByRole('tab', { name: 'Saved replies', exact: true }).click(); await page.getByRole('button', { name: 'New reply' }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill(`Local test reply ${token}`); await dialog.getByLabel('Text', { exact: true }).fill('Hello {name}, thanks for contacting us.'); await dialog.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  const { data: saved, error: replyError } = await administrator.from('support_saved_replies').select('id').eq('title', `Local test reply ${token}`).single(); expect(replyError).toBeNull(); replyId = saved!.id;
  await page.getByRole('tab', { name: 'Settings', exact: true }).click(); await expect(page.getByLabel('Greeting')).toBeVisible(); await expect(page.getByRole('switch', { name: 'Chat button on the website and dashboards' })).not.toBeChecked();
  await page.getByRole('tab', { name: 'Inbox', exact: true }).click(); await page.getByLabel('Search conversations').fill(token);
  await page.route('**/rest/v1/support_conversations?*', async route => { if (new URL(route.request().url()).searchParams.get('id') === `eq.${conversations[0]}`) await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
  await page.getByRole('button').filter({ hasText: 'Receipt printer question' }).click(); await page.getByRole('button').filter({ hasText: 'Second conversation' }).click(); await expect(page.getByRole('heading', { name: `Second tester ${token}`, exact: true })).toBeVisible(); await expect(page.getByRole('log')).toContainText('Automated local test question 2');
  await page.getByRole('button', { name: 'Saved replies', exact: true }).click(); await page.getByRole('option').filter({ hasText: `Local test reply ${token}` }).click(); await expect(page.getByLabel('Customer reply text')).toHaveValue('Hello Second tester ' + token + ', thanks for contacting us.');
  await page.getByRole('button', { name: 'Back to conversations' }).click(); await page.getByRole('button').filter({ hasText: 'Contact form question' }).click(); await expect(page.getByRole('link', { name: 'Open email draft' })).toHaveAttribute('href', /^mailto:/); await expect(page.getByLabel('Customer reply text')).toHaveCount(0);
});
