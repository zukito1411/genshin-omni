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
    if (body.action === 'artwork') return route.fulfill({ json: { artwork: { uid: body.uid, avatar: 'UI_AvatarIcon_Ayaka_Circle.png', namecard: 'UI_NameCardPic_Ambor_P.jpg' } } });
    if (body.action === 'push-status') return route.fulfill({ json: { alarm: null } });
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
  await page.getByRole('tab', { name: 'Artifacts', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Snowswept Memory' })).toBeVisible();
  await expect(page.locator('main')).toContainText('10.1%');
  await page.getByRole('tab', { name: 'Talents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kamisato Art: Hyouka' })).toBeVisible();
  await page.getByRole('tab', { name: 'Constellations', exact: true }).click();
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

test('My Profile automatically displays the selected account avatar and namecard without another lookup or browser profile cache', async ({ page }) => {
  const requests = await mock(page, { connected: true });
  await page.goto('/me');
  const banner = page.locator('.connected-profile-banner');
  await expect(banner.locator('img.profile-avatar')).toHaveAttribute('src', /UI_AvatarIcon_Ayaka_Circle\.png$/);
  await expect(banner.locator('img.profile-banner__background')).toHaveAttribute('src', /UI_NameCardPic_Ambor_P\.jpg$/);
  await expect(page.locator('.connected-profile-daily')).toContainText('40 / 200');
  await page.getByRole('searchbox', { name: 'Search owned characters', exact: true }).fill('Ayaka');
  const artwork = requests.filter((request) => request.body?.action === 'artwork');
  expect(artwork).toHaveLength(1);
  expect(artwork[0].body).toEqual({ action: 'artwork', uid: role.uid });
  expect(artwork[0].headers['x-teyvat-csrf']).toBe('c'.repeat(43));
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(banner.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible();
  }
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain(role.uid);
  expect(stored).not.toContain(role.nickname);
  expect(stored).not.toContain('enka:uid');
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(banner).toHaveCount(0);
});

test('slow or failed optional artwork never blocks private stats and malformed artwork remains a safe fallback', async ({ page }) => {
  await mock(page, { connected: true });
  let release: (() => void) | undefined;
  let started = false;
  await page.route('**/api/my-profile', async (route) => {
    const input = route.request().postData() ? route.request().postDataJSON() : undefined;
    if (input?.action !== 'artwork') return route.fallback();
    started = true; await new Promise<void>((resolve) => { release = resolve; });
    return route.fulfill({ status: 503, json: { code: 'artwork_unavailable', debug: 'private-artwork-diagnostic' } }).catch(() => undefined);
  });
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible();
  await expect(page.locator('.connected-profile-daily')).toContainText('40 / 200');
  await expect.poll(() => started).toBe(true);
  release?.();
  await expect(page.getByRole('button', { name: 'Retry artwork' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('private-artwork-diagnostic');
  await page.route('**/api/my-profile', (route) => route.request().postDataJSON()?.action === 'artwork' ? route.fulfill({ json: { artwork: { uid: role.uid, avatar: { unsafe: true }, namecard: [] } } }) : route.fallback());
  await page.getByRole('button', { name: 'Retry artwork' }).click();
  await expect(page.getByRole('button', { name: 'Retry artwork' })).toBeVisible();
  await expect(page.locator('.connected-profile-banner img.profile-avatar')).toHaveCount(0);
  await expect(page.locator('.connected-profile-daily')).toContainText('40 / 200');
});

test('account switching cancels stale artwork and image-host failures keep the private profile usable', async ({ page }) => {
  await mock(page, { connected: true });
  const otherRole = { ...role, uid: '800000002', nickname: 'Second Traveler' };
  let release: (() => void) | undefined;
  let started = false;
  let blockedArtwork = false;
  await page.route('**/api/my-profile', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { available: true, connected: true, roles: [role, otherRole], csrf: 'c'.repeat(43) } });
    const input = route.request().postDataJSON();
    if (input.action === 'profile') return route.fulfill({ json: { profile: { ...profile, role: input.uid === role.uid ? role : otherRole } } });
    if (input.action !== 'artwork') return route.fallback();
    if (input.uid === role.uid) { started = true; await new Promise<void>((resolve) => { release = resolve; }); }
    return route.fulfill({ json: { artwork: { uid: input.uid, avatar: input.uid === role.uid ? 'UI_AvatarIcon_Old.png' : blockedArtwork ? 'UI_AvatarIcon_Blocked.png' : 'UI_AvatarIcon_New.png', namecard: input.uid === role.uid ? 'UI_NameCardPic_Old_P.jpg' : blockedArtwork ? 'UI_NameCardPic_Blocked_P.jpg' : 'UI_NameCardPic_New_P.jpg' } } }).catch(() => undefined);
  });
  await page.goto('/me');
  await expect.poll(() => started).toBe(true);
  await page.getByRole('combobox', { name: 'Your Genshin account' }).selectOption(otherRole.uid);
  await expect(page.getByRole('heading', { name: otherRole.nickname, exact: true })).toBeVisible();
  release?.();
  await expect(page.locator('.connected-profile-banner img.profile-avatar')).toHaveAttribute('src', /UI_AvatarIcon_New\.png$/);
  await expect(page.locator('.connected-profile-banner img.profile-banner__background')).toHaveAttribute('src', /UI_NameCardPic_New_P\.jpg$/);
  await expect(page.locator('.connected-profile-banner')).not.toContainText(role.nickname);
  blockedArtwork = true;
  await page.route('**/*', (route) => route.request().resourceType() === 'image' && !route.request().url().startsWith('http://127.0.0.1:4173') ? route.fulfill({ status: 404 }) : route.fallback());
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry artwork' })).toBeVisible();
  await expect(page.locator('.connected-profile-daily')).toContainText('40 / 200');
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

test('owned builds stay compact on mobile, clean provider descriptions and support keyboard tabs and character switching', async ({ page }, testInfo) => {
  await mock(page, { connected: true });
  const other = { ...character, id: 10000003, name: 'Jean' };
  const description = 'Uses {LINK#N11430001}Armed for Action{/LINK}.\\n\\n<color=#00ffff>Windborne Sword</color> &amp; Spirit Blades.\\n' + 'A full ability description. '.repeat(160) + 'Final sentence.';
  await page.route('**/api/my-profile', (route) => {
    const input = route.request().postData() ? route.request().postDataJSON() : undefined;
    if (input?.action === 'profile') return route.fulfill({ json: { profile: { ...profile, characters: [character, other] } } });
    if (input?.action === 'character') return route.fulfill({ json: { character: { ...build, ...(input.characterId === other.id ? other : character), skills: Array.from({ length: 6 }, (_, index) => ({ ...build.skills[0], name: `Ability ${index + 1}`, description })), constellations: [{ ...build.constellations[0], unlocked: false, description }] } } });
    return route.fallback();
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/me/${role.uid}/characters/${character.id}`);
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ability 1', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Talents', exact: true }).click();
  const abilities = page.locator('.connected-build-ability');
  await expect(abilities).toHaveCount(6);
  await expect(page.locator('.connected-build-ability[open]')).toHaveCount(0);
  expect(await page.locator('.connected-build-abilities').evaluate((node) => node.getBoundingClientRect().height)).toBeLessThan(800);
  await page.screenshot({ path: testInfo.outputPath('mobile-build-talents.png') });
  await abilities.first().locator('summary').click();
  const paragraph = abilities.first().locator('p');
  await expect(paragraph).toBeVisible();
  await expect(paragraph).toContainText('Armed for Action.\n\nWindborne Sword & Spirit Blades.');
  await expect(paragraph).toContainText('Final sentence.');
  expect(await paragraph.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('pre-line');
  await expect(page.locator('main')).not.toContainText('{LINK');
  await expect(page.locator('main')).not.toContainText('\\n');
  await expect(page.locator('.connected-build-panel img[onerror], .connected-build-panel script')).toHaveCount(0);
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => window.scrollBy(0, 700));
  expect(await page.getByRole('tablist', { name: 'Equipped build sections' }).evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(59);
  const talents = page.getByRole('tab', { name: 'Talents', exact: true });
  await talents.focus(); await talents.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Constellations', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Snowswept Sakura', exact: true })).toBeVisible();
  await expect(page.locator('.connected-build-ability summary')).toContainText('Locked');
  await page.getByRole('tab', { name: 'Constellations', exact: true }).press('Home');
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeFocused();
  await page.getByRole('combobox', { name: 'Choose owned character', exact: true }).selectOption(String(other.id));
  await expect(page).toHaveURL(new RegExp(`/me/${role.uid}/characters/${other.id}$`));
  await expect(page.getByRole('heading', { name: 'Jean', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Talents', exact: true }).click();
  await expect(page.locator('.connected-build-ability[open]')).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain(role.uid);
  expect(stored).not.toContain('Armed for Action');
});

test('Retry artwork rechecks the same failed images rather than getting stuck in the image cooldown', async ({ page }) => {
  await mock(page, { connected: true });
  let blocked = true;
  await page.route('**/*', (route) => {
    if (!route.request().url().startsWith('http://127.0.0.1:4173') && route.request().resourceType() === 'image' && blocked) return route.fulfill({ status: 404 });
    return route.fallback();
  });
  await page.goto('/me');
  await expect(page.getByRole('button', { name: 'Retry artwork', exact: true })).toBeVisible();
  await expect(page.locator('.connected-profile-banner img.profile-avatar')).toHaveCount(0);
  blocked = false;
  await page.getByRole('button', { name: 'Retry artwork', exact: true }).click();
  await expect(page.locator('.connected-profile-banner img.profile-avatar')).toBeVisible();
  await expect(page.locator('.connected-profile-banner img.profile-banner__background')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry artwork', exact: true })).toHaveCount(0);
});

test('mobile profile shortcuts, roster filters and safe regional artwork work without extra account requests', async ({ page }, testInfo) => {
  const requests = await mock(page, { connected: true });
  const jean = { ...character, id: 10000003, name: 'Jean', element: 'Anemo', level: 80 };
  const noelle = { ...character, id: 10000034, name: 'Noelle', element: 'Geo', level: 60, rarity: 4 };
  const cover = 'https://upload-os-bbs.hoyolab.com/region-cover.png';
  const offering = 'https://upload-os-bbs.hoyolab.com/offering.png';
  const images: string[] = [];
  page.on('request', (request) => { if (request.resourceType() === 'image') images.push(request.url()); });
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as any).copiedUid = text; } } }); });
  await page.route('**/api/my-profile', (route) => {
    const input = route.request().postData() ? route.request().postDataJSON() : undefined;
    if (input?.action === 'profile') return route.fulfill({ json: { profile: { ...profile, characters: [jean, character, noelle], exploration: [{ name: 'Nod-Krai', icon: character.icon, artwork: [cover], offerings: [{ name: 'Meeting Place', icon: offering, level: 0 }], percentage: 87.1, level: 0 }] } } });
    return route.fallback();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/me');
  await expect(page.locator('.connected-profile-banner img.profile-avatar')).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: 'UID Search', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'My Profile sections' }).getByRole('button')).toHaveCount(4);
  await page.getByRole('button', { name: 'Copy UID', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'UID copied.' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).copiedUid)).toBe(role.uid);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('mobile-profile-overview.png') });
  await page.getByRole('button', { name: 'Daily notes', exact: true }).click();
  await expect(page.locator('.profile-section-anchor:focus')).toContainText('Your daily adventure');
  await expect(page.getByRole('progressbar', { name: 'Original Resin capacity' })).toHaveAttribute('value', '40');
  await expect(page.getByRole('button', { name: 'Set alarm', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-profile-daily.png') });
  const beforeFiltering = requests.length;
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  const cards = page.locator('.connected-profile-roster .showcase-card--link');
  await expect(cards).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Sort owned characters' }).selectOption('level');
  await expect(cards.first()).toContainText('Kamisato Ayaka');
  await page.getByRole('combobox', { name: 'Filter owned characters by element' }).selectOption('Geo');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Noelle');
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toContainText('Showing 1 of 3 characters');
  await page.getByRole('searchbox', { name: 'Search owned characters' }).fill('Ayaka');
  await expect(cards).toHaveCount(0);
  await expect(page.locator('.empty-state')).toContainText('No characters match your filters.');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(cards).toHaveCount(3);
  expect(requests).toHaveLength(beforeFiltering);
  expect(requests.some((request) => request.body?.action === 'character')).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('mobile-profile-characters.png') });
  await page.getByRole('button', { name: 'Exploration', exact: true }).click();
  const region = page.locator('.profile-region-card');
  await expect(region.getByRole('heading', { name: 'Nod-Krai' })).toBeVisible();
  await expect(region.locator('img.profile-region-card__artwork')).toHaveAttribute('src', cover);
  await expect(page.getByRole('progressbar', { name: 'Nod-Krai exploration' })).toHaveAttribute('value', '87.1');
  await expect(region.locator('.profile-region-card__level')).toHaveCount(0);
  expect(images).not.toContain(offering);
  await region.locator('summary').click();
  await expect(region.locator('li')).toContainText('Meeting Place');
  await expect(region.locator('li')).toContainText('Level 0');
  await expect(region.locator('li img')).toHaveAttribute('src', offering);
  await page.screenshot({ path: testInfo.outputPath('mobile-profile-exploration.png') });
  for (const width of [320, 360, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain(role.uid);
  expect(stored).not.toContain(role.nickname);
});

test('mobile profile handles long names, unknown or zero resin and clipboard denial without invented readings', async ({ page }) => {
  await mock(page, { connected: true });
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('fixture permission denial'); } } }); });
  await page.route('**/api/my-profile', (route) => {
    const input = route.request().postData() ? route.request().postDataJSON() : undefined;
    if (input?.action === 'profile') return route.fulfill({ json: { profile: { ...profile, role: { ...role, nickname: 'A very long Traveler nickname 🌟 with more text' }, notes: { ...profile.notes, resin: 0 }, exploration: [] } } });
    return route.fallback();
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/me');
  await expect(page.locator('.connected-profile-banner')).toContainText('A very long Traveler nickname');
  await page.getByRole('button', { name: 'Copy UID', exact: true }).click();
  await expect(page.locator('.profile-copy-status')).toContainText('Could not copy');
  await expect(page.locator('main')).not.toContainText('fixture permission denial');
  await expect(page.getByRole('progressbar', { name: 'Original Resin capacity' })).toHaveAttribute('value', '0');
  await expect(page.locator('.connected-profile-daily')).toContainText('0 / 200');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route('**/api/my-profile', (route) => route.request().postData() && route.request().postDataJSON().action === 'profile' ? route.fulfill({ json: { profile: { ...profile, notes: null, exploration: [], characters: [] } } }) : route.fallback());
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.connected-profile-daily')).toContainText('— / —');
  await expect(page.getByRole('progressbar', { name: 'Original Resin capacity' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Set alarm', exact: true })).toHaveCount(0);
  await expect(page.locator('.empty-state')).toContainText('Owned character details are unavailable');
  await expect(page.locator('main')).toContainText('Exploration details were not shared');
});

test('returning from a build retains in-memory roster filters, while refresh clears them', async ({ page }) => {
  await mock(page, { connected: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/me/${role.uid}`);
  await page.getByRole('searchbox', { name: 'Search owned characters' }).fill('Ayaka');
  await page.getByRole('combobox', { name: 'Filter owned characters by element' }).selectOption('Cryo');
  await page.getByRole('combobox', { name: 'Sort owned characters' }).selectOption('level');
  await page.getByRole('link', { name: /Kamisato Ayaka.*View equipped build/ }).click();
  await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to My Profile', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search owned characters' })).toHaveValue('Ayaka');
  await expect(page.getByRole('combobox', { name: 'Filter owned characters by element' })).toHaveValue('Cryo');
  await expect(page.getByRole('combobox', { name: 'Sort owned characters' })).toHaveValue('level');
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain('"search":"Ayaka"');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search owned characters' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Filter owned characters by element' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Sort owned characters' })).toHaveValue('default');
});
