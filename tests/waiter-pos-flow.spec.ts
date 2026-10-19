import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

test.describe.configure({ mode: 'serial', timeout: 120_000 });
const token = randomBytes(6).toString('hex');
const email = `waiter-pos-flow-${token}@example.com`, password = randomBytes(18).toString('hex');
const tenant = randomUUID(), category = randomUUID(), main = randomUUID(), drink = randomUUID(), table = randomUUID();
let backend: SupabaseClient, waiter: SupabaseClient, userId: string;
const staff: Record<string, { id: string; email: string }> = {};
const sql = (statement: string) => execFileSync('docker', ['exec', '-i', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('Local fixtures only');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options);
  waiter = createClient(env.API_URL, env.ANON_KEY, options);
  const result = await backend.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error || !result.data.user) throw result.error ?? new Error('Missing waiter');
  userId = result.data.user.id;
  for (const role of ['kitchen', 'admin']) {
    const email = `pos-flow-${role}-${token}@example.com`;
    const result = await backend.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw result.error ?? new Error('Missing staff fixture');
    staff[role] = { id: result.data.user.id, email };
  }
  sql(`BEGIN;
    INSERT INTO public.restaurants(id,name,slug) VALUES('${tenant}','POS flow test','waiter-pos-flow-${token}');
    INSERT INTO public.restaurant_members(user_id,restaurant_id,role) VALUES('${userId}','${tenant}','waiter');
    DELETE FROM public.user_roles WHERE user_id='${userId}';
    INSERT INTO public.user_roles(user_id,role) VALUES('${userId}','waiter');
    INSERT INTO public.restaurant_members(user_id,restaurant_id,role) VALUES('${staff.kitchen.id}','${tenant}','kitchen'),('${staff.admin.id}','${tenant}','admin');
    DELETE FROM public.user_roles WHERE user_id IN ('${staff.kitchen.id}','${staff.admin.id}');
    INSERT INTO public.user_roles(user_id,role) VALUES('${staff.kitchen.id}','kitchen'),('${staff.admin.id}','admin');
    UPDATE public.subscriptions SET plan='monthly',status='active',current_period_end=now()+interval '30 days' WHERE restaurant_id='${tenant}';
    INSERT INTO public.categories(id,name,restaurant_id) VALUES('${category}','POS test menu','${tenant}');
    INSERT INTO public.menu_items(id,name,price,category_id,restaurant_id,is_available) VALUES
      ('${main}','POS test meal',100,'${category}','${tenant}',true),('${drink}','POS test drink',50,'${category}','${tenant}',true);
    INSERT INTO public.restaurant_tables(id,label,restaurant_id) VALUES('${table}','POS table 1','${tenant}');
    UPDATE public.restaurant_settings SET tax_percentage=0,currency='BDT' WHERE restaurant_id='${tenant}';
    COMMIT;`);
  const login = await waiter.auth.signInWithPassword({ email, password }); if (login.error) throw login.error;
});

test.afterAll(async () => {
  sql(`DELETE FROM public.restaurants WHERE id='${tenant}';`);
  for (const id of [userId, ...Object.values(staff).map(user => user.id)].filter(Boolean)) { const result = await backend.auth.admin.deleteUser(id); if (result.error) throw result.error; }
});

async function openPOS(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('pos_auto_print', 'false'); });
  await page.goto('/staff-login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/waiter$/, { timeout: 30_000 });
  await page.goto('/admin/pos');
  await expect(page.getByRole('heading', { name: 'Point of Sale', exact: true })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('button', { name: 'Add POS test meal to cart', exact: true })).toBeVisible({ timeout: 20_000 });
}

async function orders() {
  const result = await backend.from('orders').select('*, order_items(*)').eq('restaurant_id', tenant).order('created_at', { ascending: false });
  if (result.error) throw result.error; return result.data;
}

test('cash checkout saves the exact cart, notes, zero tax, drawer and receipt', async ({ page }) => {
  await openPOS(page);
  await page.getByRole('button', { name: 'Open Drawer', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Cash Drawer' });
  await drawer.getByPlaceholder('Opening balance').fill('500');
  await drawer.getByRole('button', { name: 'Open Drawer', exact: true }).last().click();
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: 'Add POS test meal to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Increase POS test meal quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Add POS test drink to cart', exact: true }).click();
  await expect(page.getByText('Tax (0%)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'POS table 1', exact: true }).click();
  await page.getByPlaceholder('Order notes…').fill('POS test: no onions');
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Checkout', exact: true });
  await checkout.getByRole('button', { name: 'Cash', exact: true }).click();
  await checkout.getByRole('button', { name: /^Pay (?!Later)/ }).click();
  const receipt = page.getByRole('dialog', { name: 'Invoice / Receipt' });
  await expect(receipt).toBeVisible({ timeout: 20_000 });
  const saved = (await orders())[0];
  expect(Number(saved.total_amount)).toBe(250);
  expect(saved.tax_rate).toBe(0);
  expect(saved.table_id).toBe(table);
  expect(saved.payment_method).toBe('cash'); expect(saved.paid_at).toBeTruthy();
  expect(saved.notes).toBe('POS test: no onions');
  expect(saved.order_items.map(item => [item.menu_item_id, item.quantity]).sort()).toEqual([[main, 2], [drink, 1]].sort());
  const cash = await backend.from('cash_drawer_sessions').select('*').eq('restaurant_id', tenant).eq('status', 'open').single();
  expect(Number(cash.data?.cash_in)).toBe(250);
  await expect(receipt.getByText(/250\.00/).last()).toBeVisible();
  await receipt.getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(page.getByText('Tap items to add', { exact: true })).toBeVisible();
});

test('receipt reprint retains saved prices after the menu changes and generates printable HTML', async ({ page }) => {
  const order = (await orders()).find(order => order.notes === 'POS test: no onions')!;
  sql(`UPDATE public.menu_items SET price=175 WHERE id='${main}';`);
  try {
    await page.addInitScript(() => {
      const target = window as typeof window & { receiptHTML: string };
      target.receiptHTML = '';
      window.open = () => ({ document: { write: (html: string) => { target.receiptHTML = html; }, close: () => {} }, print: () => {}, close: () => {} }) as unknown as Window;
    });
    await openPOS(page);
    await page.getByRole('button', { name: 'Recent Orders', exact: true }).click();
    const recent = page.getByRole('dialog', { name: 'Recent Orders' });
    const row = recent.locator('div.rounded-lg').filter({ has: page.getByText(`#${order.id.slice(0, 8)}`, { exact: true }) });
    await row.getByRole('button', { name: 'View', exact: true }).click();
    const receipt = page.getByRole('dialog', { name: 'Invoice / Receipt' });
    await expect(receipt.getByText(/250\.00/).last()).toBeVisible();
    await expect(receipt.getByText(/350\.00/)).toHaveCount(0);
    await receipt.getByRole('button', { name: 'Print', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { receiptHTML: string }).receiptHTML)).toContain('250.00');
  } finally { sql(`UPDATE public.menu_items SET price=100 WHERE id='${main}';`); }
});

test('card and mobile takeaway payments save custom tax and discount, including on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPOS(page);
  for (const payment of ['Card', 'Mobile']) {
    await page.getByRole('button', { name: 'Add POS test meal to cart', exact: true }).click();
    await page.getByRole('button', { name: 'View cart', exact: true }).click();
    await page.getByRole('button', { name: 'Checkout', exact: true }).click();
    const checkout = page.getByRole('dialog', { name: 'Checkout', exact: true });
    await checkout.getByLabel('Tax percentage').fill('7.5');
    await checkout.getByLabel('Discount amount').fill('10');
    await checkout.getByRole('button', { name: payment, exact: true }).click();
    await checkout.getByRole('button', { name: /^Pay (?!Later)/ }).click();
    const receipt = page.getByRole('dialog', { name: 'Invoice / Receipt' });
    await expect(receipt).toBeVisible({ timeout: 20_000 });
    const order = (await orders())[0];
    expect(Number(order.total_amount)).toBe(97.5); expect(Number(order.tax_rate)).toBe(7.5);
    expect(Number(order.discount_amount)).toBe(10); expect(order.table_id).toBeNull();
    expect(order.payment_method).toBe(payment.toLowerCase()); expect(order.paid_at).toBeTruthy();
    await receipt.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.getByRole('button', { name: 'Back to Menu', exact: true }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('mixed split payments round correctly and only their cash portion enters the drawer', async ({ page }) => {
  sql(`UPDATE public.menu_items SET price=100.01 WHERE id='${main}';`);
  try {
    const before = await backend.from('cash_drawer_sessions').select('cash_in').eq('restaurant_id', tenant).eq('status', 'open').single();
    await openPOS(page);
    await page.getByRole('button', { name: 'Add POS test meal to cart', exact: true }).click();
    await page.getByRole('button', { name: 'Split Bill', exact: true }).click();
    const split = page.getByRole('dialog', { name: 'Split Bill' });
    await split.getByRole('button', { name: 'Cash', exact: true }).click();
    await expect(split.getByRole('button', { name: 'More split payments' })).toBeDisabled();
    await split.getByRole('button', { name: 'Card', exact: true }).click();
    const receipt = page.getByRole('dialog', { name: 'Invoice / Receipt' });
    await expect(receipt).toBeVisible({ timeout: 20_000 });
    const order = (await orders())[0];
    expect(order.payment_method).toBe('split');
    expect(order.payment_splits).toEqual([{ method: 'cash', amount: 50 }, { method: 'card', amount: 50.01 }]);
    expect(Number(order.total_amount)).toBe(100.01);
    const after = await backend.from('cash_drawer_sessions').select('cash_in').eq('restaurant_id', tenant).eq('status', 'open').single();
    expect(Number(after.data?.cash_in) - Number(before.data?.cash_in)).toBeCloseTo(50, 2);
    await expect(receipt.getByText('Split 1 (cash)', { exact: true })).toBeVisible();
    await expect(receipt.getByText('Split 2 (card)', { exact: true })).toBeVisible();
  } finally { sql(`UPDATE public.menu_items SET price=100 WHERE id='${main}';`); }
});

test('retrying after a lost checkout response creates one order and one cash payment', async ({ page }) => {
  await openPOS(page);
  await page.getByRole('button', { name: 'Add POS test drink to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Checkout', exact: true });
  const before = (await orders()).length;
  const endpoint = '**/rest/v1/rpc/pos_checkout';
  await page.route(endpoint, async route => {
    await route.fetch(); // Commit on the server, then simulate losing its response.
    await route.fulfill({ status: 503, json: { message: 'Test connection interrupted' } });
  });
  await checkout.getByRole('button', { name: /^Pay (?!Later)/ }).click();
  await expect(page.getByText('Test connection interrupted').first()).toBeVisible();
  expect((await orders()).length).toBe(before + 1);
  const firstCash = await backend.from('cash_drawer_sessions').select('cash_in').eq('restaurant_id', tenant).eq('status', 'open').single();
  await page.unroute(endpoint);
  await checkout.getByRole('button', { name: /^Pay (?!Later)/ }).click();
  await expect(page.getByRole('dialog', { name: 'Invoice / Receipt' })).toBeVisible({ timeout: 20_000 });
  expect((await orders()).length).toBe(before + 1);
  const secondCash = await backend.from('cash_drawer_sessions').select('cash_in').eq('restaurant_id', tenant).eq('status', 'open').single();
  expect(secondCash.data?.cash_in).toBe(firstCash.data?.cash_in);
});

test('invalid checkout values and failed order lines leave no partial order or cash movement', async ({ page }) => {
  await openPOS(page);
  await page.getByRole('button', { name: 'Add POS test meal to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Checkout', exact: true });
  await checkout.getByLabel('Discount amount').fill('101');
  await expect(checkout.getByRole('button', { name: /^Pay (?!Later)/ })).toBeDisabled();
  await checkout.getByLabel('Discount amount').fill('0');
  await checkout.getByLabel('Tax percentage').fill('-1');
  await expect(checkout.getByRole('button', { name: /^Pay (?!Later)/ })).toBeDisabled();
  const before = (await orders()).length;
  const drawerBefore = await backend.from('cash_drawer_sessions').select('cash_in').eq('restaurant_id', tenant).eq('status', 'open').single();
  const failed = await waiter.rpc('pos_checkout', { _restaurant: tenant, _request_key: randomUUID(), _payload: {
    items: [{ menu_item_id: main, expected_price: 100, quantity: 1 }, { menu_item_id: randomUUID(), expected_price: 1, quantity: 1 }],
    payment: 'cash', tax_rate: 0, discount_amount: 0,
  } });
  expect(failed.error).toBeTruthy();
  expect((await orders()).length).toBe(before);
  const drawerAfter = await backend.from('cash_drawer_sessions').select('cash_in').eq('restaurant_id', tenant).eq('status', 'open').single();
  expect(drawerAfter.data?.cash_in).toBe(drawerBefore.data?.cash_in);
});

test('pay-later travels through kitchen, serving, administrator payment and waiter history', async ({ page, browser }) => {
  await openPOS(page);
  await page.getByRole('button', { name: 'Add POS test meal to cart', exact: true }).click();
  await page.getByRole('button', { name: 'POS table 1', exact: true }).click();
  await page.getByPlaceholder('Order notes…').fill('Pay-later workflow test');
  await page.getByRole('button', { name: 'Checkout', exact: true }).click();
  const checkout = page.getByRole('dialog', { name: 'Checkout', exact: true });
  await checkout.getByLabel('Tax percentage').fill('5');
  await checkout.getByRole('button', { name: 'Pay Later', exact: true }).click();
  await checkout.getByRole('button', { name: 'Send to Kitchen', exact: true }).click();
  await expect(checkout).toBeHidden({ timeout: 20_000 });
  const order = (await orders()).find(order => order.notes === 'Pay-later workflow test')!;
  expect(order.paid_at).toBeNull(); expect(order.payment_method).toBeNull(); expect(Number(order.total_amount)).toBe(105);
  const kitchenContext = await browser.newContext(), adminContext = await browser.newContext();
  try {
    const kitchen = await kitchenContext.newPage();
    await kitchen.addInitScript(() => { localStorage.setItem('kds-auto-print', 'false'); });
    await kitchen.goto('/staff-login');
    await kitchen.getByLabel('Email', { exact: true }).fill(staff.kitchen.email);
    await kitchen.getByLabel('Password', { exact: true }).fill(password);
    await kitchen.getByRole('button', { name: /Sign in/i }).click();
    await expect(kitchen).toHaveURL(/\/kitchen$/, { timeout: 30_000 });
    await expect(kitchen.getByText('Kitchen Panel', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    for (const name of ['Dashboard', 'Orders', 'POS', 'Billing', 'Tables', 'Staff', 'Settings', 'Subscription']) {
      await expect(kitchen.getByRole('link', { name, exact: true })).toHaveCount(0);
    }
    await kitchen.setViewportSize({ width: 390, height: 844 });
    await expect(kitchen.getByRole('navigation', { name: 'Kitchen navigation' })).toBeVisible();
    await kitchen.getByRole('button', { name: 'Toggle kitchen navigation' }).click();
    await expect(kitchen.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(kitchen.getByRole('link', { name: 'Billing', exact: true })).toHaveCount(0);
    await kitchen.keyboard.press('Escape');
    await kitchen.getByRole('navigation', { name: 'Kitchen navigation' }).getByRole('link', { name: 'Help & support', exact: true }).click();
    await expect(kitchen.getByRole('heading', { name: 'Help & support', exact: true })).toBeVisible();
    await expect(kitchen.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
    for (const path of ['/admin', '/admin/billing', '/admin/staff', '/admin/settings', '/admin/pos']) {
      await kitchen.goto(path);
      await expect(kitchen).not.toHaveURL(new RegExp(`${path}$`), { timeout: 15_000 });
    }
    await kitchen.goto('/kitchen');
    await expect(kitchen.getByRole('heading', { name: 'Kitchen Queue', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => kitchen.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await kitchen.screenshot({ path: '/tmp/serveos-kitchen-staff-mobile.png', animations: 'disabled' });
    await kitchen.setViewportSize({ width: 1280, height: 800 });
    // Scope the kitchen action to this order, without touching other test tickets.
    const ticket = kitchen.locator('div.relative.bg-card.rounded-xl').filter({ hasText: 'Pay-later workflow test' });
    await expect(ticket).toHaveCount(1, { timeout: 20_000 });
    await ticket.getByRole('button', { name: /Start Cooking/ }).click();
    await expect(ticket.getByRole('button', { name: /Mark Ready/ })).toBeVisible({ timeout: 15_000 });
    await ticket.getByRole('button', { name: /Mark Ready/ }).click();
    await expect.poll(async () => (await backend.from('orders').select('status').eq('id', order.id).single()).data?.status).toBe('ready');
    await page.goto('/waiter');
    const card = page.locator('div.relative.bg-card').filter({ hasText: 'POS table 1' }).filter({ has: page.getByRole('button', { name: 'Mark Served', exact: true }) });
    await card.getByRole('button', { name: 'Mark Served', exact: true }).click();
    await expect.poll(async () => (await backend.from('orders').select('status').eq('id', order.id).single()).data?.status).toBe('served');
    await page.goto('/waiter/history');
    await expect(page.getByText('POS test meal', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    const denied = await waiter.rpc('pos_settle_order', { _restaurant: tenant, _order: order.id, _payment: 'cash', _tax_rate: 5, _discount: 0 });
    expect(denied.error?.code).toBe('42501');
    const admin = await adminContext.newPage();
    await admin.goto('/staff-login');
    await admin.getByLabel('Email', { exact: true }).fill(staff.admin.email);
    await admin.getByLabel('Password', { exact: true }).fill(password);
    await admin.getByRole('button', { name: /Sign in/i }).click();
    await expect(admin).toHaveURL(/\/admin$/, { timeout: 30_000 });
    await expect(admin.getByRole('link', { name: 'Billing', exact: true })).toBeVisible({ timeout: 20_000 });
    await admin.goto('/admin/billing');
    const bill = admin.locator('div.bg-card.card-shadow').filter({ hasText: `#${order.id.slice(0, 8)}` });
    await bill.getByRole('button', { name: 'Bill', exact: true }).click();
    await admin.getByRole('button', { name: /^Mark as Paid/ }).click();
    await expect.poll(async () => (await backend.from('orders').select('paid_at').eq('id', order.id).single()).data?.paid_at).toBeTruthy();
    await page.reload();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  } finally { await kitchenContext.close(); await adminContext.close(); }
});

test('checkout enforces role, tenant, price and payment checks and concurrent retries are idempotent', async () => {
  const payload = { items: [{ menu_item_id: main, expected_price: 100, quantity: 1 }], payment: 'card', tax_rate: 0, discount_amount: 0 };
  const before = (await orders()).length;
  const key = randomUUID();
  const results = await Promise.all([1, 2].map(() => waiter.rpc('pos_checkout', { _restaurant: tenant, _request_key: key, _payload: payload })));
  for (const result of results) expect(result.error).toBeNull();
  expect(results[0].data.order.id).toBe(results[1].data.order.id);
  expect((await orders()).length).toBe(before + 1);
  const changed = await waiter.rpc('pos_checkout', { _restaurant: tenant, _request_key: key, _payload: { ...payload, notes: 'Changed request' } });
  expect(changed.error?.code).toBe('PT409');
  const stale = await waiter.rpc('pos_checkout', { _restaurant: tenant, _request_key: randomUUID(), _payload: { ...payload, items: [{ ...payload.items[0], expected_price: 1 }] } });
  expect(stale.error?.code).toBe('PT409');
  const foreignTable = await waiter.rpc('pos_checkout', { _restaurant: tenant, _request_key: randomUUID(), _payload: { ...payload, table_id: randomUUID() } });
  expect(foreignTable.error?.code).toBe('42501');
  const wrongPayment = await waiter.rpc('pos_checkout', { _restaurant: tenant, _request_key: randomUUID(), _payload: { ...payload, payments: [{ method: 'card', amount: 1 }] } });
  expect(wrongPayment.error).toBeTruthy();
  const wrongTenant = await waiter.rpc('pos_checkout', { _restaurant: randomUUID(), _request_key: randomUUID(), _payload: payload });
  expect(wrongTenant.error).toBeTruthy();
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const kitchen = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await kitchen.auth.signInWithPassword({ email: staff.kitchen.email, password });
  expect(login.error).toBeNull();
  const denied = await kitchen.rpc('pos_checkout', { _restaurant: tenant, _request_key: randomUUID(), _payload: payload });
  expect(denied.error?.code).toBe('42501');
  const privateReceipt = await waiter.rpc('pos_order_receipt', { _order: results[0].data.order.id });
  expect(privateReceipt.error?.code).toBe('42501');
  expect((await orders()).length).toBe(before + 1);
});

test('customer tax remains authoritative and paid totals remain frozen', () => {
  const orderId = randomUUID();
  sql(`BEGIN;
    UPDATE public.restaurant_settings SET tax_percentage=5 WHERE restaurant_id='${tenant}';
    INSERT INTO public.orders(id,user_id,restaurant_id,tax_rate) VALUES('${orderId}','${userId}','${tenant}',5);
    INSERT INTO public.order_items(order_id,restaurant_id,menu_item_id,quantity) VALUES('${orderId}','${tenant}','${main}',1);
    SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${randomUUID()}"}',true);
    UPDATE public.orders SET tax_rate=0,discount_amount=99 WHERE id='${orderId}';
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='${orderId}' AND tax_rate=5 AND discount_amount=0 AND total_amount=105) THEN RAISE EXCEPTION 'Customer pricing must use restaurant tax'; END IF;
    END $$;
    SELECT set_config('request.jwt.claims','',true);
    UPDATE public.orders SET paid_at=now() WHERE id='${orderId}';
    UPDATE public.orders SET tax_rate=0,discount_amount=50,total_amount=1 WHERE id='${orderId}';
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='${orderId}' AND tax_rate=5 AND discount_amount=0 AND total_amount=105) THEN RAISE EXCEPTION 'Paid pricing must remain frozen'; END IF;
    END $$;
    ROLLBACK;`);
});

