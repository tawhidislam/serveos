import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

test.describe.configure({ mode: 'serial' });
const token = randomBytes(6).toString('hex'), email = `downloads-admin-${token}@example.com`, password = randomBytes(18).toString('hex');
let backend: SupabaseClient, administrator: SupabaseClient, visitor: SupabaseClient, member: SupabaseClient;
let adminId: string, memberId: string, original: unknown;
const uploaded: string[] = [];

test.beforeAll(async () => {
  const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (!['localhost', '127.0.0.1'].includes(new URL(env.API_URL).hostname)) throw new Error('Local fixtures only');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  backend = createClient(env.API_URL, env.SERVICE_ROLE_KEY, options);
  administrator = createClient(env.API_URL, env.ANON_KEY, options);
  visitor = createClient(env.API_URL, env.ANON_KEY, options);
  member = createClient(env.API_URL, env.ANON_KEY, options);
  const { data: saved, error: savedError } = await backend.from('platform_app_downloads').select('content').eq('id', true).single();
  if (savedError) throw savedError; original = saved.content;
  const { data, error } = await backend.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('Missing admin'); adminId = data.user.id;
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `INSERT INTO platform_admins(email,notes) VALUES('${email}','Disposable downloads test');`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const { data: user, error: userError } = await backend.auth.admin.createUser({ email: `downloads-member-${token}@example.com`, password, email_confirm: true });
  if (userError || !user.user) throw userError ?? new Error('Missing member'); memberId = user.user.id;
  const { error: signInError } = await administrator.auth.signInWithPassword({ email, password }); if (signInError) throw signInError;
  const { error: memberError } = await member.auth.signInWithPassword({ email: `downloads-member-${token}@example.com`, password }); if (memberError) throw memberError;
});

test.afterAll(async () => {
  if (original) { const { error } = await backend.from('platform_app_downloads').update({ content: original }).eq('id', true); if (error) throw error; }
  if (uploaded.length) { const { error } = await backend.storage.from('platform-apps').remove(uploaded); if (error) throw error; }
  execFileSync('docker', ['exec', 'supabase_db_mzwrasiyigxsbyomdazk', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DELETE FROM platform_admins WHERE email='${email}';`], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (const id of [adminId, memberId].filter(Boolean)) { const { error } = await backend.auth.admin.deleteUser(id); if (error) throw error; }
});

test('anonymous downloads are readable; regular accounts cannot publish or upload installers', async () => {
  const { data, error } = await visitor.from('platform_app_downloads').select('content').eq('id', true).single(); expect(error).toBeNull(); expect(data).toBeTruthy();
  const denied = await member.from('platform_app_downloads').update({ content: { compromised: true } }).eq('id', true).select();
  expect(denied.data ?? []).toHaveLength(0);
  const rejected = await member.storage.from('platform-apps').upload(`unauthorized-${token}.apk`, Buffer.from([80, 75, 3, 4]), { contentType: 'application/vnd.android.package-archive' });
  expect(rejected.error).toBeTruthy();
});

test('public page, four-platform publishing, installer uploads, concurrent edits and responsive navigation', async ({ page, browser }) => {
  test.setTimeout(60_000);
  await page.goto('/platform/login');
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/ }).click(); await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/apps'); await expect(page.getByRole('heading', { name: 'App downloads', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Page content' }).click();
  const title = `Restaurant app ${token}`;
  await page.getByLabel('Page heading', { exact: true }).fill(title);
  await page.getByRole('tab', { name: 'Android', exact: true }).click();
  await page.getByLabel('Google Play URL').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Enter a Google Play URL (play.google.com).').first()).toBeVisible();
  await page.getByLabel('Google Play URL').fill('');
  await page.getByLabel('Upload Android APK', { exact: true }).setInputFiles({ name: 'serveos-test.apk', mimeType: 'application/vnd.android.package-archive', buffer: Buffer.from([80, 75, 3, 4, 0, 0, 0, 0]) });
  await expect(page.getByLabel('APK download URL')).toHaveValue(/platform-apps\/android\//, { timeout: 20_000 });
  const apk = await page.getByLabel('APK download URL').inputValue(); uploaded.push(decodeURIComponent(new URL(apk).pathname.split('/platform-apps/')[1]));
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(page.getByText('App download page saved').first()).toBeVisible();
  const publicContext = await browser.newContext(), publicPage = await publicContext.newPage();
  try {
    await publicPage.goto('http://127.0.0.1:8080/download'); await expect(publicPage.getByRole('heading', { name: title })).toBeVisible();
    await expect(publicPage.getByRole('link', { name: 'Download Android APK' })).toHaveCount(0);
    await page.getByLabel('Availability', { exact: true }).click(); await page.getByRole('option', { name: 'Available now' }).click();
    await page.getByLabel('Version', { exact: true }).fill('1.2.3');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await publicPage.reload(); const link = publicPage.getByRole('link', { name: 'Download Android APK' }); await expect(link).toHaveAttribute('href', apk);
    expect((await publicPage.request.get(apk)).status()).toBe(200);
    await expect(publicPage.getByText('Version 1.2.3')).toBeVisible();

    const dmg = Buffer.alloc(512); dmg.set([107, 111, 108, 121]);
    for (const desktop of [
      { name: 'Windows', platform: 'windows', extension: 'exe', mimeType: 'application/octet-stream', buffer: Buffer.from([77, 90, 0, 0, 0, 0, 0, 0]) },
      { name: 'macOS', platform: 'macos', extension: 'dmg', mimeType: 'application/x-apple-diskimage', buffer: dmg },
    ]) {
      await page.getByRole('tab', { name: desktop.name, exact: true }).click();
      await expect(page.getByLabel(`${desktop.name} installer URL`)).toHaveValue('');
      await page.getByLabel(`${desktop.name} installer URL`).fill('javascript:alert(1)');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(page.getByText('Use an HTTPS installer link, or upload an installer.').first()).toBeVisible();
      await page.getByLabel(`${desktop.name} installer URL`).fill('');
      if (desktop.platform === 'windows') {
        await page.getByLabel('Upload Windows installer', { exact: true }).setInputFiles({ name: 'invalid.exe', mimeType: desktop.mimeType, buffer: Buffer.from('not an executable') });
        await expect(page.getByText('This file does not match the .exe installer format.').first()).toBeVisible();
      }
      await page.getByLabel(`Upload ${desktop.name} installer`, { exact: true }).setInputFiles({ name: `serveos-test.${desktop.extension}`, mimeType: desktop.mimeType, buffer: desktop.buffer });
      await expect(page.getByLabel(`${desktop.name} installer URL`)).toHaveValue(new RegExp(`platform-apps/${desktop.platform}/`), { timeout: 20_000 });
      const url = await page.getByLabel(`${desktop.name} installer URL`).inputValue();
      uploaded.push(decodeURIComponent(new URL(url).pathname.split('/platform-apps/')[1]));
      await page.getByLabel('Availability', { exact: true }).click();
      await page.getByRole('option', { name: 'Available now' }).click();
      await page.getByLabel('Version', { exact: true }).fill('2.0.0');
      await page.getByLabel('Minimum OS', { exact: true }).fill(desktop.platform === 'windows' ? 'Windows 10+' : 'macOS 12+');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
      await publicPage.reload();
      await expect(publicPage.getByRole('link', { name: `Download for ${desktop.name}`, exact: true })).toHaveAttribute('href', url);
      expect((await publicPage.request.get(url)).status()).toBe(200);
      const card = publicPage.getByRole('article', { name: `${desktop.name} app download`, exact: true });
      await expect(card.getByText('Version 2.0.0')).toBeVisible();
    }
    await expect(publicPage.getByRole('article', { name: /app download$/ })).toHaveCount(4);
    await publicPage.setViewportSize({ width: 390, height: 844 });
    expect(await publicPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await publicPage.getByRole('button', { name: 'Open menu' }).click();
    await expect(publicPage.getByRole('link', { name: 'Download', exact: true }).last()).toBeVisible();
    await publicPage.getByRole('link', { name: 'Download', exact: true }).last().click(); await expect(publicPage.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await page.getByRole('tab', { name: 'Android', exact: true }).click();
    const other = await administrator.from('platform_app_downloads').select('content').eq('id', true).single();
    const modified = { ...other.data!.content, support_note: 'Changed from another admin session.' };
    const changed = await administrator.from('platform_app_downloads').update({ content: modified }).eq('id', true); expect(changed.error).toBeNull();
    await page.getByLabel('Version', { exact: true }).fill('1.2.4'); await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('These settings changed in another tab. Reload saved settings before saving again.').first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally { await publicContext.close(); }
});

test('saving preserves newer edits and upload controls work with the keyboard', async ({ page }) => {
  await page.goto('/platform/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await page.goto('/platform/apps');
  await page.getByRole('tab', { name: 'Page content', exact: true }).click();
  const heading = page.getByLabel('Page heading', { exact: true });
  const savedTitle = `Saved heading ${token}`, newerTitle = `Newer unsaved heading ${token}`;
  await heading.fill(savedTitle);
  let releaseSave: () => void;
  const heldSave = new Promise<void>(resolve => { releaseSave = resolve; });
  const endpoint = '**/rest/v1/platform_app_downloads*';
  await page.route(endpoint, async route => {
    if (route.request().method() === 'PATCH') await heldSave;
    await route.continue();
  });
  try {
    const sent = page.waitForRequest(request => request.method() === 'PATCH' && request.url().includes('/rest/v1/platform_app_downloads'));
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await sent;
    await heading.fill(newerTitle);
    const completed = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/rest/v1/platform_app_downloads'));
    releaseSave!(); await completed;
    await expect(heading).toHaveValue(newerTitle);
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
    const saved = await administrator.from('platform_app_downloads').select('content').eq('id', true).single();
    expect(saved.data?.content.title).toBe(savedTitle);
    const savedAgain = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/rest/v1/platform_app_downloads'));
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await savedAgain;
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    const latest = await administrator.from('platform_app_downloads').select('content').eq('id', true).single();
    expect(latest.data?.content.title).toBe(newerTitle);
  } finally { releaseSave!(); await page.unroute(endpoint); }

  await page.getByRole('tab', { name: 'Windows', exact: true }).click();
  const upload = page.getByRole('button', { name: 'Upload Windows installer', exact: true });
  await upload.focus();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles({ name: 'wrong-format.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('not an executable') });
  await expect(page.getByText('This file does not match the .exe installer format.').first()).toBeVisible();
  await expect(upload).toBeEnabled();
});
