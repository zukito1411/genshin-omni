import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { captchaPage } from '../netlify/functions/hoyolab-captcha.mjs';
import type { PrivateBuild, PrivateProfile } from '../src/types/myProfile';

const role = { uid: '800000001', region: 'os_asia', server: 'Asia', nickname: 'Private Traveler', level: 60 };
const character = { id: 10000002, name: 'Kamisato Ayaka', icon: 'https://upload-os-bbs.hoyolab.com/character.png', element: 'Cryo', rarity: 5, level: 90, friendship: 10, constellation: 3 };
const profile: PrivateProfile = {
  role, updatedAt: Date.now(), unavailable: [],
  stats: { achievements: 1200, daysActive: 900, characters: 50, abyss: '12-3', theaterAct: 10, stygian: null, waypoints: 200, domains: 50, chests: [{ label: 'Common chests', value: 0 }] },
  notes: { resin: 40, maxResin: 200, recoverySeconds: 72000, commissions: 4, maxCommissions: 4, commissionRewardClaimed: true, realmCurrency: 1500, maxRealmCurrency: 2400, expeditions: [{ icon: character.icon, status: 'Ongoing', remainingSeconds: 7200 }] },
  exploration: [{ name: 'Mondstadt', icon: character.icon, percentage: 100, level: 8 }], characters: [character],
};
const build: PrivateBuild = { ...character, image: character.icon, stats: [{ label: 'CRIT DMG', value: '210%' }], weapon: { name: 'Mistsplitter Reforged', icon: character.icon, level: 90, refinement: 1, rarity: 5, stats: [{ label: 'Base ATK', value: '674' }] }, artifacts: [{ name: 'Snowswept Memory', icon: character.icon, level: 20, slot: 'Flower of Life', set: 'Blizzard Strayer', stats: [{ label: 'HP', value: '4,780' }, { label: 'CRIT Rate', value: '10.1%' }] }], skills: [{ name: 'Kamisato Art: Hyouka', icon: character.icon, level: 10, description: 'Deals Cryo DMG.' }], constellations: [{ name: 'Snowswept Sakura', icon: character.icon, unlocked: true, description: 'Cryo strikes reduce skill cooldown.' }] };
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e8c77d"/></svg>';
async function mock(page: Page, options: { available?: boolean; connected?: boolean; profileFailure?: boolean; noNotes?: boolean; expireOnRefresh?: boolean } = {}) {
  let connected = options.connected ?? false;
  let gets = 0;
  const requests: Array<{ method: string; body: any; headers: Record<string, string> }> = [];
  await page.route('**/*', (route) => {
    const request = route.request();
    if (request.url().startsWith('http://127.0.0.1:4173')) return route.continue();
    if (request.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: image });
    return route.fulfill({ status: 404 });
  });
  await page.route('**/api/my-profile', (route) => {
    const request = route.request();
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() : undefined;
    requests.push({ method, body, headers: request.headers() });
    if (method === 'GET') {
      gets++;
      if (options.expireOnRefresh && gets > 1) connected = false;
      return route.fulfill({ json: { available: options.available !== false, connected, ...(connected ? { roles: [role], csrf: 'c'.repeat(43), expiresAt: Date.now() + 86400000 } : {}) } });
    }
    if (method === 'DELETE') { connected = false; return route.fulfill({ json: { available: true, connected: false } }); }
    if (body.action === 'connect') { connected = true; return route.fulfill({ json: { available: true, connected: true, roles: [role], csrf: 'c'.repeat(43) } }); }
    if (options.profileFailure) return route.fulfill({ status: 503, json: { code: 'unavailable', debug: 'do-not-display-internal-log' } });
    if (body.action === 'profile') return route.fulfill({ json: { profile: options.noNotes ? { ...profile, notes: null, unavailable: ['notes'] } : profile } });
    return route.fulfill({ json: { character: build } });
  });
  return requests;
}
async function connect(page: Page) {
  await page.getByText('Advanced session connection (optional)', { exact: true }).click();
  await page.getByLabel('HoYoLAB account ID', { exact: true }).fill('12345');
  await page.getByLabel('HoYoLAB session token', { exact: true }).fill('fixture-session-token-not-real');
  await page.getByRole('checkbox', { name: /securely storing my session/ }).check();
  await page.getByRole('button', { name: 'Connect account', exact: true }).click();
  await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible();
}

test('My Profile is the second navigation item and safely unavailable on static deployments', async ({ page }) => {
  const requests = await mock(page, { available: false });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/me');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link').nth(1)).toHaveText('My Profile');
  await expect(page.getByRole('heading', { name: 'Account connection is not available yet' })).toBeVisible();
  await expect(page.getByLabel('HoYoLAB session token', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect account', exact: true })).toHaveCount(0);
  expect(requests.every((request) => request.method === 'GET')).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('connection consent, readable daily notes and owned builds work across mobile and desktop', async ({ page }) => {
  const requests = await mock(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/me');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await connect(page);
  await expect(page.locator('.connected-profile-daily')).toContainText('40 / 200');
  await expect(page.locator('.connected-profile-daily')).toContainText('Daily reward claimed');
  await expect(page.locator('.connected-profile-expeditions')).toContainText('2h 0m');
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible();
  }
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(stored).not.toContain('fixture-session-token');
  expect(stored).not.toContain(role.nickname);
  await page.getByRole('link', { name: /Kamisato Ayaka.*View equipped build/ }).click();
  await expect(page).toHaveURL(/\/me\/800000001\/characters\/10000002$/);
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged', exact: true })).toBeVisible();
  await expect(page.locator('main')).toContainText('674');
  await expect(page.locator('main')).toContainText('210%');
  await expect(page.getByRole('heading', { name: 'Snowswept Memory' })).toBeVisible();
  await expect(page.locator('main')).toContainText('10.1%');
  await expect(page.getByRole('heading', { name: 'Kamisato Art: Hyouka' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Snowswept Sakura' })).toBeVisible();
  await expect(page.locator('main pre, .showcase-raw')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const profileRequests = requests.filter((request) => request.body?.action === 'profile' || request.body?.action === 'character');
  expect(profileRequests.every((request) => request.headers['x-teyvat-csrf'] === 'c'.repeat(43))).toBe(true);
  expect(errors).toEqual([]);
});

test('direct sign-in is the main flow, encrypts credentials, and keeps tokens out of the default UI', async ({ page }) => {
  const requests = await mock(page);
  const loginRequests: any[] = [];
  await page.route('**/api/hoyolab-login', (route) => {
    loginRequests.push(route.request().postDataJSON());
    return route.fulfill({ json: { available: true, connected: true, roles: [role], csrf: 'c'.repeat(43) } });
  });
  await page.goto('/me');
  await expect(page.getByLabel('HoYoLAB session token', { exact: true })).not.toBeVisible();
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    if (width === 390) await page.screenshot({ path: 'test-results/hoyolab-login-mobile.png', fullPage: true });
  }
  await page.getByLabel('Email or username', { exact: true }).fill('test@example.invalid');
  await page.getByLabel('HoYoverse password', { exact: true }).fill('fake-password-only');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('HoYoverse password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await page.getByRole('checkbox', { name: /I agree to connect it/ }).check();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible();
  expect(loginRequests).toHaveLength(1);
  expect(loginRequests[0].action).toBe('login');
  for (const name of ['account', 'password']) expect(Buffer.from(loginRequests[0][name], 'base64')).toHaveLength(256);
  expect(JSON.stringify(loginRequests)).not.toContain('fake-password-only');
  expect(JSON.stringify(loginRequests)).not.toContain('test@example.invalid');
  expect(requests.some((request) => request.body?.action === 'connect')).toBe(false);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/fake-password|test@example/);
});

test('direct login errors are safe and passwords are cleared on failure and tab hiding', async ({ page }) => {
  await mock(page);
  await page.route('**/api/hoyolab-login', (route) => route.fulfill({ status: 401, json: { code: 'login_failed', message: 'raw-secret-do-not-display' } }));
  await page.goto('/me');
  await page.getByLabel('Email or username', { exact: true }).fill('fixture@example.invalid');
  await page.getByLabel('HoYoverse password', { exact: true }).fill('fake-password-only');
  await page.getByRole('checkbox', { name: /I agree to connect it/ }).check();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Check your email or username and password');
  await expect(page.getByLabel('HoYoverse password', { exact: true })).toHaveValue('');
  await expect(page.locator('main')).not.toContainText('raw-secret-do-not-display');
  await page.getByLabel('HoYoverse password', { exact: true }).fill('another-fake-password');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByLabel('HoYoverse password', { exact: true })).toHaveValue('');
});

test('cancelled sign-in ignores a late response and the direct-login kill switch keeps the easy UID option', async ({ page }) => {
  await mock(page);
  let release: (() => void) | undefined;
  let started = false;
  await page.route('**/api/hoyolab-login', async (route) => {
    if (route.request().method() === 'DELETE') return route.fulfill({ json: { cancelled: true } });
    started = true; await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ json: { available: true, connected: true, roles: [role], csrf: 'c'.repeat(43) } }).catch(() => undefined);
  });
  await page.goto('/me');
  await page.getByLabel('Email or username', { exact: true }).fill('fixture@example.invalid');
  await page.getByLabel('HoYoverse password', { exact: true }).fill('fake-password-only');
  await page.getByRole('checkbox', { name: /I agree to connect it/ }).check();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByRole('button', { name: 'Cancel sign-in' }).click();
  release?.();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  await expect(page.getByLabel('HoYoverse password', { exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toHaveCount(0);
  await page.route('**/api/my-profile', (route) => route.fulfill({ json: { available: true, connected: false, directLogin: false } }));
  await page.reload();
  await expect(page.getByText('Direct sign-in is temporarily unavailable on this site.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('HoYoverse password', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'UID Search', exact: true }).last()).toBeVisible();
});

test('CAPTCHA runs in an isolated mobile dialog and authenticates only after a real server result', async ({ page }) => {
  const diagnostics: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(message.text()); });
  page.on('pageerror', (error) => diagnostics.push(error.message));
  await mock(page);
  const policy = readFileSync('netlify.toml', 'utf8').match(/Content-Security-Policy = "([^"]+)"/)![1];
  if (process.env.PLAYWRIGHT_PRODUCTION === '1') await page.route('http://127.0.0.1:4173/me', async (route) => {
    const response = await route.fetch(); return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  });
  await page.route('**/api/hoyolab-captcha', async (route) => {
    const response = captchaPage('http://127.0.0.1:4173');
    return route.fulfill({ status: 200, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.route('https://static.geetest.com/static/js/gt.0.5.0.js', (route) => route.fulfill({ contentType: 'text/javascript', body: `window.initGeetest = (config, callback) => {
    let success; const instance = { appendTo: (selector) => { const button = document.createElement('button'); button.textContent = 'Complete test security check'; button.onclick = () => success(); document.querySelector(selector).append(button); }, onReady: (cb) => cb(), onError: () => {}, onSuccess: (cb) => { success = cb; }, getValidate: () => ({ geetest_challenge: 'fixture-challenge', geetest_validate: 'fixture-validation', geetest_seccode: 'fixture-validation|jordan' }) };
    window.parentAccessible = false; try { window.parentAccessible = !!parent.document; } catch {}
    callback(instance);
  };` }));
  const requests: any[] = [];
  await page.route('**/api/hoyolab-login', (route) => {
    const input = route.request().postDataJSON(); requests.push(input);
    return route.fulfill({ json: input.action === 'login' ? { challenge: { version: 3, sessionId: 'fixture-session', gt: 'a'.repeat(32), challenge: 'fixture-challenge', newCaptcha: true, offline: false }, ticket: 'fixture-ticket', expiresAt: Date.now() + 300000 } : { available: true, connected: true, roles: [role], csrf: 'c'.repeat(43) } });
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/me');
  await page.getByLabel('Email or username', { exact: true }).fill('fixture@example.invalid');
  await page.getByLabel('HoYoverse password', { exact: true }).fill('fake-password-only');
  await page.getByRole('checkbox', { name: /I agree to connect it/ }).check();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const captcha = page.frameLocator('iframe[title="HoYoLAB login security challenge"]');
  try { await expect(captcha.getByRole('button', { name: 'Complete test security check' })).toBeVisible(); }
  catch (error) { throw new Error(`${error}\nBrowser diagnostics: ${diagnostics.join('\n')}`); }
  const child = page.frames().find((entry) => entry.url().includes('/api/hoyolab-captcha'))!;
  expect(await child.evaluate(() => (window as any).parentAccessible)).toBe(false);
  expect(await child.evaluate(() => { try { return !!localStorage; } catch { return false; } })).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.postMessage({ type: 'captcha-success', id: 'invalid', proof: {} }, '*'));
  expect(requests).toHaveLength(1);
  await captcha.getByRole('button', { name: 'Complete test security check' }).click();
  await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].action).toBe('verify');
  expect(requests[1].account).toBe(requests[0].account);
  expect(requests[1].password).toBe(requests[0].password);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('disconnect clears private screens and preserves roster preferences', async ({ page }) => {
  await mock(page, { connected: true });
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('teyvat-atlas:owned-characters:v1', '["10000002"]'));
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Connect your own HoYoLAB account', exact: true })).toBeVisible();
  await expect(page.getByText(role.nickname, { exact: true })).toHaveCount(0);
  await expect(page.locator('.connected-profile-daily, .connected-profile-roster')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('teyvat-atlas:owned-characters:v1'))).toBe('["10000002"]');
});

test('missing daily notes do not become zero resin and failed requests stay player-friendly', async ({ page }) => {
  await mock(page, { connected: true, noNotes: true });
  await page.goto('/me');
  await expect(page.locator('.connected-profile-daily')).toContainText('— / —');
  await expect(page.locator('.connected-profile-daily')).not.toContainText('0 /');
  await expect(page.locator('.showcase-card--link')).toContainText('Kamisato Ayaka');
  await page.route('**/api/my-profile', (route) => route.request().method() === 'GET' ? route.fulfill({ json: { available: true, connected: true, roles: [role], csrf: 'c'.repeat(43) } }) : route.fulfill({ status: 503, json: { code: 'unavailable', debug: 'private-upstream-error' } }));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('HoYoLAB could not be reached');
  await expect(page.locator('main')).not.toContainText('private-upstream-error');
});

test('expired sessions return to connection and an unrelated UID never receives a private data request', async ({ page }) => {
  const requests = await mock(page, { connected: true });
  await page.goto('/me/800000999');
  await expect(page.locator('.empty-state')).toContainText('This UID is not connected');
  expect(requests.some((request) => request.body?.uid === '800000999')).toBe(false);
  await page.route('**/api/my-profile', (route) => route.fulfill({ json: { available: true, connected: false } }));
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Connect your own HoYoLAB account', exact: true })).toBeVisible();
  await expect(page.locator('.connected-profile-daily')).toHaveCount(0);
});

test('Paimon receives only public page context, never the connected profile or tokens', async ({ page }) => {
  await mock(page, { connected: true });
  let payload: any;
  await page.route('**/api/paimon-chat', (route) => { payload = route.request().postDataJSON(); return route.fulfill({ json: { reply: 'Hi, Traveler!' } }); });
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible();
  await page.locator('.paimon-launcher').click();
  await page.getByRole('textbox', { name: 'Ask Paimon', exact: true }).fill('How are you?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.locator('#paimon-helper > p')).toContainText('Hi, Traveler!');
  expect(payload.page).toBe('account');
  expect(JSON.stringify(payload)).not.toContain(role.nickname);
  expect(JSON.stringify(payload)).not.toContain(role.uid);
  expect(Object.keys(payload).sort()).toEqual(['localTime', 'page', 'question']);
});

test('production security policy permits the private page and blocks third-party scripts', async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION !== '1', 'Strict production CSP does not allow Vite development inline scripts.');
  await mock(page, { connected: true });
  const policy = readFileSync('netlify.toml', 'utf8').match(/Content-Security-Policy = "([^"]+)"/)![1];
  await page.route('http://127.0.0.1:4173/**', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible();
  await expect(page.locator('.connected-profile-daily')).toContainText('40 / 200');
  await page.getByRole('link', { name: /Kamisato Ayaka.*View equipped build/ }).click();
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged', exact: true })).toBeVisible();
  const blocked = await page.evaluate(() => new Promise<boolean>((resolve) => {
    document.addEventListener('securitypolicyviolation', (event) => { if (event.effectiveDirective.startsWith('script-src')) resolve(true); }, { once: true });
    const script = document.createElement('script');
    script.src = 'https://untrusted.example.test/script.js';
    document.body.appendChild(script);
  }));
  expect(blocked).toBe(true);
  expect(errors).toEqual([]);
});
