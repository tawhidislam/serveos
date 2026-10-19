import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

test.describe.configure({ mode: 'serial', timeout: 120_000 });
const token = randomBytes(6).toString('hex'), password = randomBytes(18).toString('hex');
const tenant = randomUUID(), otherTenant = randomUUID(), branch = randomUUID(), otherBranch = randomUUID(), category = randomUUID(), meal = randomUUID(), otherMeal = randomUUID(), table = randomUUID();
const order = randomUUID(), foreignOrder = randomUUID();
const users: Record<string, { id: string; email: string; client: SupabaseClient }> = {};
let backend: SupabaseClient;
const sql = (statement: string) => execFileSync('docker', ['exec', '-i', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('Local fixtures only');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options);
  for (const name of ['kitchen', 'waiter', 'otherwaiter', 'customer']) {
    const email = `kitchen-ops-${name}-${token}@example.com`;
    const result = await backend.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw result.error ?? new Error('Missing fixture user');
    const client = createClient(env.API_URL, env.ANON_KEY, options);
    const login = await client.auth.signInWithPassword({ email, password }); if (login.error) throw login.error;
    users[name] = { id: result.data.user.id, email, client };
  }
  sql(`BEGIN;
    INSERT INTO restaurants(id,name,slug) VALUES('${tenant}','Kitchen Operations Test','kitchen-ops-${token}'),('${otherTenant}','Other kitchen tenant','kitchen-ops-other-${token}');
    UPDATE subscriptions SET plan='monthly',status='active',current_period_end=now()+interval '30 days' WHERE restaurant_id IN ('${tenant}','${otherTenant}');
    INSERT INTO branches(id,name,restaurant_id) VALUES('${branch}','Main kitchen','${tenant}'),('${otherBranch}','Other kitchen','${tenant}');
    ${['kitchen','waiter','otherwaiter'].map(name => `INSERT INTO restaurant_members(user_id,restaurant_id,role) VALUES('${users[name].id}','${tenant}','${name === 'otherwaiter' ? 'waiter' : name}'); DELETE FROM user_roles WHERE user_id='${users[name].id}'; INSERT INTO user_roles(user_id,role) VALUES('${users[name].id}','${name === 'otherwaiter' ? 'waiter' : name}'); INSERT INTO staff_branches(user_id,restaurant_id,branch_id) VALUES('${users[name].id}','${tenant}','${name === 'otherwaiter' ? otherBranch : branch}');`).join('\n')}
    INSERT INTO categories(id,name,restaurant_id) VALUES('${category}','Kitchen test menu','${tenant}');
    INSERT INTO menu_items(id,name,price,prep_time_minutes,restaurant_id,category_id,branch_id) VALUES('${meal}','Kitchen test chicken',100,10,'${tenant}','${category}','${branch}'),('${otherMeal}','Other branch soup',50,5,'${tenant}','${category}','${otherBranch}');
    INSERT INTO restaurant_tables(id,label,restaurant_id,branch_id) VALUES('${table}','Kitchen table 1','${tenant}','${branch}');
    INSERT INTO orders(id,user_id,restaurant_id,branch_id,table_id,notes) VALUES('${order}','${users.waiter.id}','${tenant}','${branch}','${table}','Kitchen operations fixture');
    INSERT INTO order_items(order_id,restaurant_id,menu_item_id,quantity) VALUES('${order}','${tenant}','${meal}',1);
    INSERT INTO orders(id,user_id,restaurant_id,branch_id) VALUES('${foreignOrder}','${users.waiter.id}','${tenant}','${otherBranch}');
    COMMIT;`);
});

test.afterAll(async () => {
  sql(`DELETE FROM restaurants WHERE id IN ('${tenant}','${otherTenant}');`);
  for (const user of Object.values(users)) { const result = await backend.auth.admin.deleteUser(user.id); if (result.error) throw result.error; }
});

async function login(page: Page, role: string) {
  await page.addInitScript(() => localStorage.setItem('kds-auto-print', 'false'));
  await page.goto('/staff-login');
  await page.getByLabel('Email', { exact: true }).fill(users[role].email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL(role === 'kitchen' ? /\/kitchen$/ : /\/waiter$/, { timeout: 30_000 });
}
async function savedOrder() { const result = await backend.from('orders').select('*').eq('id', order).single(); if (result.error) throw result.error; return result.data; }

test('timers persist, overdue alerts display, and kitchen messages reach the waiter', async ({ page, browser }) => {
  await login(page, 'kitchen');
  const ticket = page.locator('div.relative.bg-card.rounded-xl').filter({ hasText: 'Kitchen operations fixture' });
  await ticket.getByRole('button', { name: /Start Cooking/ }).click();
  await expect(ticket.getByText(/remaining$/)).toBeVisible({ timeout: 15_000 });
  const started = await savedOrder();
  expect(started.kitchen_started_at).toBeTruthy(); expect(started.kitchen_target_minutes).toBe(10);
  await ticket.getByRole('button', { name: 'Set remaining time', exact: true }).click();
  await page.getByLabel('Minutes remaining', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Save ready time', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect((await savedOrder()).kitchen_started_at).toBe(started.kitchen_started_at);
  const waiterContext = await browser.newContext();
  try {
    const waiter = await waiterContext.newPage(); await login(waiter, 'waiter');
    await ticket.getByRole('button', { name: 'Message waiter', exact: true }).click();
    const thread = page.getByRole('dialog');
    const before = (await savedOrder()).kitchen_due_at;
    await thread.getByRole('button', { name: '5 more minutes', exact: true }).click();
    await expect(thread.getByText('Please allow five more minutes.', { exact: true })).toBeVisible();
    const after = await savedOrder();
    expect(Date.parse(after.kitchen_due_at) - Date.parse(before)).toBe(300000);
    expect(after.kitchen_started_at).toBe(started.kitchen_started_at); expect(after.kitchen_target_minutes).toBe(10);
    sql(`UPDATE orders SET notes='Kitchen operations fixture — unrelated edit' WHERE id='${order}';`);
    expect((await savedOrder()).kitchen_due_at).toBe(after.kitchen_due_at);
    await expect(waiter.getByText('Please allow five more minutes.', { exact: true })).toBeVisible({ timeout: 15_000 });
    await waiter.getByRole('button', { name: 'View kitchen updates', exact: true }).click();
    await expect(waiter.getByRole('dialog').getByText('Please allow five more minutes.', { exact: true })).toBeVisible();
    await expect(waiter.getByRole('button', { name: 'Send update', exact: true })).toHaveCount(0);
    await thread.getByRole('button', { name: 'Item unavailable', exact: true }).click();
    await thread.getByLabel('Message to waiter', { exact: true }).fill('Chicken needs an alternative side. Please check with the guest.');
    await thread.getByRole('button', { name: 'Send update', exact: true }).click();
    await expect(thread.getByText('Chicken needs an alternative side. Please check with the guest.', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  } finally { await waiterContext.close(); }
  sql(`UPDATE orders SET kitchen_due_at=now()-interval '2 minutes' WHERE id='${order}';`);
  await page.reload();
  await expect(page.getByText(/1 overdue cooking ticket/)).toBeVisible({ timeout: 15_000 });
  await expect(ticket.getByText(/^Overdue /)).toBeVisible();
  expect((await savedOrder()).kitchen_started_at).toBe(started.kitchen_started_at);
});

test('authorized kitchen staff can hide and restore dishes and sold-out checkout is rejected', async ({ page }) => {
  await login(page, 'kitchen');
  await page.getByRole('button', { name: 'Availability', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Menu availability' })).toBeVisible();
  await expect(page.getByText('Other branch soup', { exact: true })).toHaveCount(0);
  const toggle = page.getByRole('switch', { name: 'Kitchen test chicken availability', exact: true });
  await expect(toggle).toBeChecked(); await toggle.click(); await expect(toggle).not.toBeChecked();
  const failed = await users.waiter.client.rpc('pos_checkout', { _restaurant: tenant, _request_key: randomUUID(), _payload: { items: [{ menu_item_id: meal, expected_price: 100, quantity: 1 }], table_id: table, tax_rate: 0, discount_amount: 0, payment: 'pay_later' } });
  expect(failed.error).toBeTruthy();
  expect((await savedOrder()).status).toBe('preparing');
  await toggle.click(); await expect(toggle).toBeChecked();
  expect((await backend.from('menu_items').select('is_available').eq('id', meal).single()).data?.is_available).toBe(true);
});

test('history and preparation reports preserve real duration and original targets', async ({ page }) => {
  sql(`UPDATE orders SET kitchen_started_at=now()-interval '20 minutes',kitchen_target_minutes=10,kitchen_due_at=now()+interval '5 minutes',notes='Kitchen operations fixture <b>Kitchen note</b>' WHERE id='${order}';`);
  await login(page, 'kitchen');
  await page.locator('div.relative.bg-card.rounded-xl').filter({ hasText: 'Kitchen operations fixture' }).getByRole('button', { name: /Mark Ready/ }).click();
  await expect.poll(async () => (await savedOrder()).status).toBe('ready');
  expect((await savedOrder()).kitchen_ready_at).toBeTruthy();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prepared ticket history' })).toBeVisible();
  await expect(page.getByText('1 prepared tickets', { exact: true })).toBeVisible();
  await expect(page.getByText(/20\.\d min cooking · target 10 min · Delayed/)).toBeVisible();
  await page.getByText('View items (1)', { exact: true }).click();
  await expect(page.getByText('1× Kitchen test chicken', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const target = window as typeof window & { ticketHTML: string };
    target.ticketHTML = '';
    window.open = () => ({ document: { write: (html: string) => { target.ticketHTML = html; }, close: () => {} }, focus: () => {}, print: () => {}, close: () => {} }) as unknown as Window;
  });
  await page.getByRole('button', { name: /^Reprint ticket/ }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { ticketHTML: string }).ticketHTML)).toContain('&lt;b&gt;Kitchen note&lt;/b&gt;');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Preparation reports' })).toBeVisible();
  const report = await users.kitchen.client.rpc('kitchen_report', { _restaurant: tenant, _days: 7 });
  expect(report.error).toBeNull(); expect(report.data.summary).toMatchObject({ prepared: 1, late: 1, on_time_percent: 0 });
  expect(report.data.summary.average_minutes).toBeGreaterThanOrEqual(20);
  await expect(page.getByText(`${report.data.summary.average_minutes} min`, { exact: true }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/serveos-kitchen-reports.png', animations: 'disabled' });
});

test('kitchen RPCs and message reads enforce roles, restaurants and branch assignment', async () => {
  for (const role of ['waiter', 'customer']) {
    const client = users[role].client;
    for (const result of await Promise.all([
      client.rpc('kitchen_set_availability', { _restaurant: tenant, _item: meal, _available: false }),
      client.rpc('kitchen_set_eta', { _restaurant: tenant, _order: order, _minutes: 5 }),
      client.rpc('kitchen_send_update', { _restaurant: tenant, _order: order, _message: 'Forbidden' }),
      client.rpc('kitchen_report', { _restaurant: tenant, _days: 7 }),
    ])) expect(result.error?.code).toBe('42501');
  }
  const client = users.kitchen.client;
  expect((await client.rpc('kitchen_menu', { _restaurant: otherTenant })).error?.code).toBe('42501');
  expect((await client.rpc('kitchen_set_availability', { _restaurant: tenant, _item: otherMeal, _available: false })).error?.code).toBe('42501');
  expect((await client.rpc('kitchen_send_update', { _restaurant: tenant, _order: foreignOrder, _message: 'Forbidden' })).error?.code).toBe('42501');
  expect((await client.rpc('kitchen_send_update', { _restaurant: tenant, _order: order, _message: '   ' })).error).toBeTruthy();
  for (const role of ['otherwaiter', 'customer']) {
    const result = await users[role].client.from('kitchen_updates').select('*').eq('order_id', order);
    expect(result.error).toBeNull(); expect(result.data).toEqual([]);
  }
  const visible = await users.waiter.client.from('kitchen_updates').select('*').eq('order_id', order);
  expect(visible.error).toBeNull(); expect(visible.data).toHaveLength(2);
  const direct = await users.kitchen.client.from('kitchen_updates').insert({ restaurant_id: tenant, order_id: order, message: 'Bypass' });
  expect(direct.error?.code).toBe('42501');
  const legacy = randomUUID(), cancelled = randomUUID();
  sql(`INSERT INTO orders(id,user_id,restaurant_id,branch_id,status) VALUES('${legacy}','${users.waiter.id}','${tenant}','${branch}','completed');
    INSERT INTO orders(id,user_id,restaurant_id,branch_id,status,kitchen_started_at,kitchen_ready_at,kitchen_target_minutes) VALUES('${cancelled}','${users.waiter.id}','${tenant}','${branch}','cancelled',now()-interval '20 minutes',now(),10);`);
  const history = await client.rpc('kitchen_history', { _restaurant: tenant, _days: 1 });
  expect(history.error).toBeNull(); expect(history.data.total).toBe(2);
  expect(history.data.orders.find((row: { id: string }) => row.id === legacy).kitchen_started_at).toBeNull();
  const report = await client.rpc('kitchen_report', { _restaurant: tenant, _days: 7 });
  expect(report.error).toBeNull(); expect(report.data.summary.prepared).toBe(1);
  sql(`UPDATE subscriptions SET status='expired',current_period_end=now()-interval '1 day' WHERE restaurant_id='${tenant}';`);
  expect((await client.rpc('kitchen_set_availability', { _restaurant: tenant, _item: meal, _available: false })).error?.code).toBe('42501');
});
