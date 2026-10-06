import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createLocalResinAlarms } from '../src/utils/localResinAlarms';
import { resinDueAt, validResin } from '../src/utils/resinTiming';
import { MyProfileError } from '../src/api/myProfile';
import { createProfileHandler } from '../netlify/functions/my-profile.mjs';

function setup() {
  let clock = 1_800_000_000_000, value: any = { resin: 20, maxResin: 200, recoverySeconds: 180 * 480 - 120 }, reads = 0;
  let read = async () => { reads++; return value; };
  const notifications: any[] = [], timers = new Map<number, { callback: () => void; delay: number }>(); let nextTimer = 0;
  const service = createLocalResinAlarms({ now: () => clock, read: (_uid, _csrf, _signal) => read(), notify: async (...args) => { notifications.push(args); }, setTimer: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; }, clearTimer: (id) => { timers.delete(id); } });
  const arm = (extra = {}) => service.arm({ uid: '800000001', csrf: 'c'.repeat(43), expiresAt: clock + 86400000, notes: value, readAt: clock, target: 40, deviceNotification: false, ...extra });
  return { service, arm, notifications, timers, reads: () => reads, now: () => clock, advance: (ms: number) => { clock += ms; }, notes: (notes: any) => { value = notes; }, reader: (fn: () => Promise<any>) => { read = fn; } };
}

test('resin timing preserves partial ticks and missing recovery never turns into an invented resin alert', () => {
  expect(resinDueAt({ resin: 20, maxResin: 200, recoverySeconds: 180 * 480 - 120 }, 40, 1000)).toBe(1000 + (20 * 480 - 120) * 1000);
  expect(resinDueAt({ resin: 40, maxResin: 200, recoverySeconds: null }, 40, 1000)).toBe(1000);
  expect(resinDueAt({ resin: 0, maxResin: 200, recoverySeconds: 200 * 480 }, 1, 1000)).toBe(481000);
  for (const target of [0, 201, 1.5, NaN]) expect(resinDueAt({ resin: 20, maxResin: 200, recoverySeconds: 80000 }, target, 1000)).toBeNull();
  for (const recoverySeconds of [null, -1, 1e9, 0]) expect(resinDueAt({ resin: 20, maxResin: 200, recoverySeconds }, 40, 1000)).toBeNull();
  expect(validResin({ resin: 0, maxResin: 200, recoverySeconds: null })).toBe(true);
  expect(validResin({ resin: null, maxResin: 200, recoverySeconds: null })).toBe(false);
});

test('local alarms require no configuration, do no idle polling, and expose neither CSRF nor readings in snapshots', async () => {
  const api = setup(), stop = api.service.start();
  expect(api.timers.size).toBe(0); await api.service.checkDue(); expect(api.reads()).toBe(0);
  api.arm(); expect(api.timers.size).toBe(1);
  expect([...api.timers.values()][0].delay).toBe((20 * 480 - 120) * 1000);
  const snapshot = api.service.getSnapshot();
  expect(snapshot.alarms[0]).toMatchObject({ target: 40, state: 'armed', deviceNotification: false });
  expect(JSON.stringify(snapshot)).not.toContain('c'.repeat(43)); expect(snapshot.alarms[0]).not.toHaveProperty('notes');
  api.service.cancel('800000001'); expect(api.timers.size).toBe(0); stop();
  expect(createLocalResinAlarms().getSnapshot().alarms).toEqual([]); // Reload starts empty, no browser persistence.
});

test('spending resin reschedules; a fresh reading fires the in-site alert once with optional device delivery', async () => {
  const api = setup(); api.arm({ deviceNotification: true });
  await api.service.checkDue(); expect(api.reads()).toBe(0);
  api.advance(20 * 480000); api.notes({ resin: 10, maxResin: 200, recoverySeconds: 190 * 480 });
  await api.service.checkDue(); expect(api.service.getSnapshot().notice).toBeNull();
  expect(api.service.getSnapshot().alarms[0].dueAt).toBe(api.now() + 30 * 480000);
  api.advance(30 * 480000); api.notes({ resin: 41, maxResin: 200, recoverySeconds: 159 * 480 });
  await Promise.all([api.service.checkDue(), api.service.checkDue()]);
  expect(api.service.getSnapshot().notice).toMatchObject({ ready: true, message: expect.stringContaining('41 (target 40)') });
  expect(api.notifications).toHaveLength(1); expect(api.notifications[0][0]).not.toContain('800000001');
  await api.service.checkDue(); expect(api.notifications).toHaveLength(1);
  api.service.dismiss(); expect(api.service.getSnapshot().notice).toBeNull();
});

test('cancelling, replacing, disconnecting and expiry discard late responses rather than displaying stale alerts', async () => {
  for (const mode of ['cancel', 'replace', 'clear', 'expiry']) {
    const api = setup(); api.arm({ target: 20, deviceNotification: true });
    let release!: (value: any) => void, started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    api.reader(() => { started(); return new Promise((resolve) => { release = resolve; }); });
    const pending = api.service.checkDue(); await ready;
    if (mode === 'cancel') api.service.cancel('800000001');
    if (mode === 'replace') api.arm({ target: 100 });
    if (mode === 'clear') api.service.clear();
    if (mode === 'expiry') api.advance(86400001);
    release({ resin: 40, maxResin: 200, recoverySeconds: 160 * 480 }); await pending;
    expect(api.notifications).toHaveLength(0); expect(api.service.getSnapshot().notice).toBeNull();
    if (mode === 'expiry') { await api.service.checkDue(); expect(api.service.getSnapshot().alarms).toEqual([]); }
  }
});

test('missing recovery checks actual resin and resume checks fresh data without polling on every focus', async () => {
  const api = setup(); api.notes({ resin: 20, maxResin: 200, recoverySeconds: null }); api.arm();
  expect(api.service.getSnapshot().alarms[0].dueAt).toBe(api.now() + 60000);
  await api.service.checkDue(true); expect(api.reads()).toBe(0);
  api.advance(60001); await api.service.checkDue(true); expect(api.reads()).toBe(1);
  expect(api.service.getSnapshot().notice).toBeNull();
  await api.service.checkDue(true); expect(api.reads()).toBe(1);
});

test('network failures back off without raw logs and expired sessions stop all alarms', async () => {
  const api = setup(); api.arm({ target: 20 }); api.reader(async () => { throw new Error('PRIVATE NETWORK BODY'); });
  for (let index = 0; index < 5; index++) { await api.service.checkDue(); api.advance(300001); }
  expect(api.service.getSnapshot().alarms[0].state).toBe('unavailable');
  expect(JSON.stringify(api.service.getSnapshot())).not.toContain('PRIVATE NETWORK BODY');
  api.arm({ target: 20 }); api.reader(async () => { throw new MyProfileError('reconnect'); }); await api.service.checkDue();
  expect(api.service.getSnapshot().alarms).toEqual([]); expect(api.service.getSnapshot().notice?.message).toContain('connection ended');
});

test('private notes reads preserve session, CSRF, origin, ownership and cancellation security without new env settings', async () => {
  const records = new Map<string, any>(); let reads = 0;
  const store = { get: async (key: string) => records.get(key), getMetadata: async (key: string) => records.has(key) ? {} : null, setJSON: async (key: string, value: any) => { records.set(key, value); return { modified: true }; }, delete: async (key: string) => { records.delete(key); } };
  const origin = 'https://app.test', role = { uid: '800000001', region: 'os_asia' };
  const provider = { roles: async () => [role], notes: async () => { reads++; return { resin: 40, maxResin: 200, recoverySeconds: 160 * 480 }; } };
  const handler = createProfileHandler({ env: { HOYOLAB_ENABLED: 'true', HOYOLAB_ENCRYPTION_KEY: 'ab'.repeat(32), HOYOLAB_APP_ORIGIN: origin, CONTEXT: 'production' }, storeFactory: () => store, provider });
  const request = (body?: object, cookie?: string, csrf?: string, extra = {}, method = 'POST') => new Request(origin + '/api/my-profile', { method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Teyvat-Client': 'profile', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-Teyvat-CSRF': csrf } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const connected = await handler(request({ action: 'connect', accountId: '123', token: 'fake-token-for-tests-only', version: 'v2', consent: true }));
  const cookie = connected.headers.get('set-cookie')!.split(';')[0], csrf = (await connected.json()).csrf, payload = { action: 'notes', uid: role.uid };
  for (const invalid of [request(payload, cookie), request(payload, cookie, csrf, { Origin: 'https://evil.test' }), request({ ...payload, uid: '800000002' }, cookie, csrf), request({ ...payload, url: 'https://evil.test' }, cookie, csrf)]) expect([400, 403]).toContain((await handler(invalid)).status);
  expect(reads).toBe(0);
  const result = await handler(request(payload, cookie, csrf)); expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toContain('no-store');
  expect((await result.json()).notes.resin).toBe(40); await handler(request(payload, cookie, csrf)); expect(reads).toBe(1);
  await handler(request(undefined, cookie, csrf, {}, 'DELETE'));
  expect((await handler(request(payload, cookie, csrf))).status).toBe(401);
});

test('notification clicks open only the local profile; notification worker never caches or schedules account requests', async () => {
  const handlers: Record<string, any> = {}, opened: string[] = [], promises: Promise<any>[] = [];
  const script = readFileSync('public/resin-worker.js', 'utf8'), origin = 'https://app.test';
  runInNewContext(script, { URL, self: { addEventListener: (event: string, fn: any) => { handlers[event] = fn; }, location: { origin }, clients: { matchAll: async () => [], openWindow: async (url: string) => { opened.push(url); } } } });
  handlers.notificationclick({ notification: { close: () => {}, data: { path: 'https://evil.test' } }, waitUntil: (promise: Promise<any>) => promises.push(promise) });
  await Promise.all(promises); expect(opened).toEqual([origin + '/me']);
  expect(Object.keys(handlers)).toEqual(['install', 'activate', 'push', 'notificationclick']); expect(script).not.toContain('setTimeout');
  expect(readFileSync('README.md', 'utf8')).not.toContain('RESIN_VAPID_');
});
