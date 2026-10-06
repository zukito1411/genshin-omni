import { expect, test, type Page } from '@playwright/test';
import webpush from 'web-push';
const testPublicKey = webpush.generateVAPIDKeys().publicKey;

const role = { uid: '800000001', nickname: 'Private Traveler', server: 'Asia', region: 'os_asia', level: 60 };
const character = { id: 10000002, name: 'Kamisato Ayaka', icon: 'https://upload-os-bbs.hoyolab.com/UI_AvatarIcon_Ayaka.png', element: 'Cryo', rarity: 5, level: 90, friendship: 10, constellation: 3 };
const profile = { role, unavailable: [], stats: { achievements: 1000, daysActive: 900, characters: 1, abyss: '12-3', theaterAct: 10, stygian: null, chests: [], waypoints: 100, domains: 40 }, notes: { resin: 40, maxResin: 200, recoverySeconds: 160 * 480, commissions: 4, maxCommissions: 4, commissionRewardClaimed: true, realmCurrency: 100, maxRealmCurrency: 2400, expeditions: [] }, exploration: [{ name: 'Nod-Krai', icon: character.icon, percentage: 87.1, level: 0 }], characters: [character] };
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e8c77d"/></svg>';

async function mock(page: Page, { noNotes = false, permission = 'granted', unsupported = false, failNotes = false, pushMode = false, pushFailure = false, loseSave = false } = {}) {
  await page.addInitScript(({ permission, unsupported, pushMode, testPublicKey }) => {
    const stats = { permissions: 0, registrations: 0, shown: [] as any[] }; (window as any).notificationStats = stats;
    if (unsupported) { delete (window as any).Notification; return; }
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission, requestPermission: async () => {
      stats.permissions++;
      if (permission === 'default') {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
        await new Promise((resolve) => setTimeout(resolve, 30));
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange'));
        (window as any).Notification.permission = 'granted'; return 'granted';
      }
      return permission;
    } } });
    const listeners = new Set<(event: any) => void>();
    const pushManager = pushMode ? { getSubscription: async () => null, subscribe: async (options: any) => {
      if (!options.userVisibleOnly || options.applicationServerKey.length !== 65) throw new Error('invalid subscription options');
      return { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/fake-browser-test', keys: { auth: 'AQEBAQEBAQEBAQEBAQEBAQ', p256dh: testPublicKey } }) };
    } } : undefined;
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      addEventListener: (name: string, fn: any) => { if (name === 'message') listeners.add(fn); }, removeEventListener: (_name: string, fn: any) => listeners.delete(fn),
      register: async () => { stats.registrations++; return { active: {}, pushManager, update: async () => {}, showNotification: async (...args: any[]) => { stats.shown.push(args); } }; },
    } });
    (window as any).emitResinPush = (body: string, tag: string) => { for (const listener of listeners) listener({ source: { scriptURL: new URL('/resin-worker.js', location.origin).href }, data: { type: 'resin-delivered', body, tag } }); };
  }, { permission, unsupported, pushMode, testPublicKey });
  let resin = 40, connected = true;
  const requests: any[] = [];
  let serverAlarm: any = null;
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith('http://127.0.0.1:4173')) return route.continue();
    return route.request().resourceType() === 'image' ? route.fulfill({ contentType: 'image/svg+xml', body: svg }) : route.fulfill({ status: 404 });
  });
  await page.route('**/api/my-profile', (route) => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ json: { available: true, connected, ...(connected ? { roles: [role], csrf: 'c'.repeat(43), expiresAt: Date.now() + 86400000 } : {}) } });
    if (request.method() === 'DELETE') { connected = false; serverAlarm = null; return route.fulfill({ json: { available: true, connected: false } }); }
    const body = request.postDataJSON(); requests.push({ body, headers: request.headers() });
    if (body.action === 'profile') return route.fulfill({ json: { profile: { ...profile, updatedAt: Date.now(), notes: noNotes ? null : profile.notes } } });
    if (body.action === 'artwork') return route.fulfill({ json: { artwork: { uid: body.uid, avatar: 'UI_AvatarIcon_Ayaka_Circle.png', namecard: 'UI_NameCardPic_Ambor_P.jpg' } } });
    if (body.action === 'push-status') return route.fulfill({ json: { alarm: serverAlarm } });
    if (body.action === 'push-remove') { serverAlarm = null; return route.fulfill({ json: { alarm: null } }); }
    if (body.action === 'push-prepare') return pushFailure ? route.fulfill({ status: 503, json: { code: 'push_unavailable', debug: 'PRIVATE_PUSH_LOG' } }) : route.fulfill({ json: { publicKey: testPublicKey } });
    if (body.action === 'push-save') {
      serverAlarm = { target: body.target, state: 'armed', dueAt: Date.now() + 60000, expiresAt: Date.now() + 86400000, tag: 'resin-' + 'a'.repeat(24), requestId: body.requestId };
      if (loseSave) return route.abort('failed');
      return route.fulfill({ json: { alarm: serverAlarm } });
    }
    if (body.action === 'notes') return failNotes ? route.fulfill({ status: 503, json: { code: 'unavailable', debug: 'raw-private-response' } }) : route.fulfill({ json: { notes: { resin, maxResin: 200, recoverySeconds: (200 - resin) * 480 } } });
    return route.fulfill({ json: { character: { ...character, image: character.icon, stats: [], weapon: { name: 'Mistsplitter Reforged', icon: character.icon, level: 90, refinement: 1, rarity: 5, stats: [{ label: 'Base ATK', value: '674' }] }, artifacts: [], skills: [], constellations: [] } } });
  });
  return { requests, notes: (value: number) => { resin = value; }, delivered: () => { if (serverAlarm) serverAlarm.state = 'delivered'; } };
}

test('local alarm needs no extra setup, preserves refresh/navigation, has mobile controls and cancels', async ({ page }) => {
  const api = await mock(page); await page.goto('/me');
  await expect(page.getByRole('button', { name: 'Set alarm', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).notificationStats)).toEqual({ permissions: 0, registrations: 0, shown: [] });
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('spinbutton', { name: 'Resin alarm target' }).fill('80'); await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await expect(page.getByText('Paimon will alert you at 80 resin or above.', { exact: false })).toBeVisible();
  expect(api.requests.some((request) => request.body.action.startsWith('alarm-'))).toBe(false);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await expect(page.getByRole('spinbutton', { name: 'Resin alarm target' })).toHaveValue('80');
  await page.getByRole('link', { name: /Kamisato Ayaka.*View equipped build/ }).click(); await expect(page.getByRole('heading', { name: 'Mistsplitter Reforged', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to My Profile' }).click(); await expect(page.getByRole('spinbutton', { name: 'Resin alarm target' })).toHaveValue('80');
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'test-results/local-resin-alarm-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel alarm', exact: true }).click(); await expect(page.getByRole('button', { name: 'Set alarm', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Private Traveler|800000001|resin-target/);
});

test('fresh resin shows a persistent Paimon alert on any page and optional device notification with her face', async ({ page }) => {
  const api = await mock(page); await page.goto('/me');
  await page.getByRole('spinbutton', { name: 'Resin alarm target' }).fill('40'); await page.getByRole('checkbox', { name: 'Also notify on this device' }).check();
  await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  const notice = page.getByRole('status', { name: 'Paimon resin notification' });
  await expect(notice).toContainText('Original Resin is now 40 (target 40)');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const stats = await page.evaluate(() => (window as any).notificationStats);
  expect(stats.shown).toHaveLength(1); expect(stats.shown[0][1]).toMatchObject({ icon: '/paimon/face.png', data: { path: '/me' } });
  const reading = api.requests.find((request) => request.body.action === 'notes'); expect(reading.headers['x-teyvat-csrf']).toBe('c'.repeat(43));
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Roster', exact: true }).click();
  await expect(notice).toBeVisible(); await page.getByRole('button', { name: 'Dismiss resin notification' }).click(); await expect(notice).toHaveCount(0);
});

test('permission denial or unsupported notifications never disables the in-site alarm', async ({ page }) => {
  await mock(page, { permission: 'denied' }); await page.goto('/me');
  await page.getByRole('spinbutton', { name: 'Resin alarm target' }).fill('40'); await page.getByRole('checkbox', { name: 'Also notify on this device' }).check(); await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await expect(page.getByText('Device notifications are off.', { exact: false })).toBeVisible(); await expect(page.getByRole('status', { name: 'Paimon resin notification' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).notificationStats.registrations)).toBe(0);
  await mock(page, { unsupported: true }); await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Also notify on this device' })).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Resin alarm target' }).fill('40'); await page.getByRole('button', { name: 'Set alarm', exact: true }).click(); await expect(page.getByRole('status', { name: 'Paimon resin notification' })).toBeVisible();
});

test('reload and disconnect cancel local alarms; missing notes means no alarm controls', async ({ page }) => {
  await mock(page); await page.goto('/me'); await page.getByRole('button', { name: 'Set alarm', exact: true }).click(); await expect(page.getByRole('button', { name: 'Cancel alarm' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: 'Cancel alarm' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Set alarm', exact: true }).click(); await page.getByRole('button', { name: 'Disconnect', exact: true }).click(); await expect(page.locator('.resin-alarm')).toHaveCount(0);
  await mock(page, { noNotes: true }); await page.reload(); await expect(page.getByRole('heading', { name: role.nickname, exact: true })).toBeVisible(); await expect(page.locator('.resin-alarm')).toHaveCount(0);
});

test('resuming an elapsed local alarm checks actual resin after spending rather than trusting its old timer', async ({ page }) => {
  const api = await mock(page); await page.goto('/me'); await page.clock.install();
  await page.getByRole('spinbutton', { name: 'Resin alarm target' }).fill('41'); await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  api.notes(10); await page.clock.fastForward(8 * 60000 + 2000);
  await expect.poll(() => api.requests.filter((request) => request.body.action === 'notes').length).toBe(1);
  await expect(page.getByRole('status', { name: 'Paimon resin notification' })).toHaveCount(0);
  api.notes(42); await page.clock.fastForward(60001);
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.getByRole('status', { name: 'Paimon resin notification' })).toContainText('now 42 (target 41)');
});

test('mobile permission dialog return preserves setup and never requests a push subscription', async ({ page }) => {
  await mock(page, { permission: 'default' }); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/me');
  await page.getByRole('checkbox', { name: 'Also notify on this device' }).check(); await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel alarm', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).notificationStats)).toEqual({ permissions: 1, registrations: 1, shown: [] });
});

test('supported installed-app notifications need only permission, survive reload, and cancel the server alarm', async ({ page }) => {
  const api = await mock(page, { pushMode: true, permission: 'default' }); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/me');
  await expect(page.getByRole('button', { name: 'Set alarm', exact: true })).toBeVisible();
  expect(api.requests.some((request) => request.body.action === 'push-prepare')).toBe(false);
  await page.getByRole('checkbox', { name: 'Also notify on this device' }).check(); await page.getByRole('spinbutton', { name: 'Resin alarm target' }).fill('80'); await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await expect(page.getByText('Device alarm saved. You can close the app.', { exact: false })).toBeVisible();
  const saved = api.requests.find((request) => request.body.action === 'push-save'); expect(saved.body.target).toBe(80); expect(saved.body.publicKey).toBe(testPublicKey); expect(saved.body.requestId).toMatch(/^[a-f\d-]{36}$/);
  expect(saved.headers['x-teyvat-csrf']).toBe('c'.repeat(43));
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toMatch(/Private Traveler|800000001|fcm\/send/);
  await page.reload(); await expect(page.getByRole('spinbutton', { name: 'Resin alarm target' })).toHaveValue('80');
  await expect(page.getByText('Device alarm saved. You can close the app.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel alarm', exact: true }).click(); await expect(page.getByRole('button', { name: 'Set alarm', exact: true })).toBeVisible();
  expect(api.requests.filter((request) => request.body.action === 'push-remove')).toHaveLength(1);
});

test('incoming push updates Paimon in the open app without sending a duplicate local phone notification', async ({ page }) => {
  const api = await mock(page, { pushMode: true }); await page.goto('/me');
  await page.getByRole('checkbox', { name: 'Also notify on this device' }).check(); await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await expect(page.getByText('Device alarm saved.', { exact: false })).toBeVisible();
  api.delivered();
  await page.evaluate(() => (window as any).emitResinPush('Hey Traveler! Your Original Resin is now 60.', 'resin-' + 'a'.repeat(24)));
  await expect(page.getByRole('status', { name: 'Paimon resin notification' })).toContainText('now 60');
  await expect(page.getByText('This device alarm is no longer active.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as any).notificationStats.shown)).toEqual([]);
  expect(api.requests.some((request) => request.body.action === 'notes')).toBe(false);
});

test('background setup failure keeps an honest local fallback and never shows private logs', async ({ page }) => {
  await mock(page, { pushMode: true, pushFailure: true }); await page.goto('/me');
  await page.getByRole('checkbox', { name: 'Also notify on this device' }).check(); await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel alarm', exact: true })).toBeVisible();
  await expect(page.getByText('Using the open-app alarm instead;', { exact: false })).toBeVisible();
  await expect(page.getByText('Device alarm saved.', { exact: false })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('PRIVATE_PUSH_LOG');
});

test('a lost save response is reconciled instead of arming a second local alarm', async ({ page }) => {
  const api = await mock(page, { pushMode: true, loseSave: true }); await page.goto('/me');
  await page.getByRole('checkbox', { name: 'Also notify on this device' }).check(); await page.getByRole('button', { name: 'Set alarm', exact: true }).click();
  await expect(page.getByText('Device alarm saved.', { exact: false })).toBeVisible();
  expect(api.requests.filter((request) => request.body.action === 'push-save')).toHaveLength(1);
  expect(api.requests.filter((request) => request.body.action === 'push-status').length).toBeGreaterThan(1);
  expect(api.requests.some((request) => request.body.action === 'notes')).toBe(false);
});
