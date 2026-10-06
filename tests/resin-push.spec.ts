import { expect, test } from '@playwright/test';
import webpush from 'web-push';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { configuration, unseal } from '../netlify/lib/profile-security.mjs';
import { createProfileHandler } from '../netlify/functions/my-profile.mjs';
import { createResinScheduler } from '../netlify/functions/resin-notifications.mjs';
import { getPushKeys, pushDueAt, validatePushSubscription } from '../netlify/lib/resin-push.mjs';
import { createLocalResinAlarms } from '../src/utils/localResinAlarms';

const env = { CONTEXT: 'production', HOYOLAB_ENABLED: 'true', HOYOLAB_APP_ORIGIN: 'https://app.test', HOYOLAB_ENCRYPTION_KEY: 'ab'.repeat(32) };
const config = configuration(env), role = { uid: '800000001', region: 'os_asia', nickname: 'Private Traveler' };
const userKeys = webpush.generateVAPIDKeys();
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/fake-browser-subscription', keys: { p256dh: userKeys.publicKey, auth: Buffer.alloc(16, 1).toString('base64url') } };
function memoryStore() {
  let revision = 0; const records = new Map<string, any>();
  return {
    records,
    get: async (key: string) => records.has(key) ? structuredClone(records.get(key).data) : null,
    getMetadata: async (key: string) => records.has(key) ? { etag: records.get(key).etag, metadata: structuredClone(records.get(key).metadata) } : null,
    getWithMetadata: async (key: string) => records.has(key) ? structuredClone(records.get(key)) : null,
    setJSON: async (key: string, data: any, options: any = {}) => {
      if (options.onlyIfNew && records.has(key) || options.onlyIfMatch && records.get(key)?.etag !== options.onlyIfMatch) return { modified: false };
      const etag = String(++revision); records.set(key, { data: structuredClone(data), metadata: options.metadata, etag }); return { modified: true, etag };
    },
    delete: async (key: string) => { records.delete(key); },
    list: async function* ({ prefix = '' } = {}) { yield { blobs: [...records.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
async function setup() {
  const sessions = memoryStore(), pushes = memoryStore(); let clock = 1_800_000_000_000;
  let notes = { resin: 20, maxResin: 200, recoverySeconds: 180 * 480 - 120 }, calls = 0;
  let read = async () => { calls++; return notes; };
  const provider = { roles: async () => [role], notes: async () => read() };
  const handler = createProfileHandler({ env, now: () => clock, provider, storeFactory: () => sessions, pushStoreFactory: () => pushes });
  const request = (body?: object, cookie?: string, csrf?: string, extra = {}, method = 'POST') => new Request(env.HOYOLAB_APP_ORIGIN + '/api/my-profile', { method, headers: { Origin: env.HOYOLAB_APP_ORIGIN, 'Content-Type': 'application/json', 'X-Teyvat-Client': 'profile', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-Teyvat-CSRF': csrf } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const connection = await handler(request({ action: 'connect', accountId: '123', token: 'FAKE-test-token-not-a-real-credential', version: 'v2', consent: true }));
  const cookie = connection.headers.get('set-cookie')!.split(';')[0], csrf = (await connection.json()).csrf;
  const invoke = (action: string, extra = {}) => handler(request({ action, uid: role.uid, ...extra }, cookie, csrf));
  const save = async (extra = {}) => {
    const prepared = await (await invoke('push-prepare')).json();
    return invoke('push-save', { target: 40, publicKey: prepared.publicKey, subscription, requestId: randomUUID(), ...extra });
  };
  const sent: any[] = []; let send = async (...args: any[]) => { sent.push(args); };
  const scheduler = createResinScheduler({ env, now: () => clock, provider, sessionStoreFactory: () => sessions, pushStoreFactory: () => pushes, send: (...args: any[]) => send(...args) });
  return { sessions, pushes, handler, request, cookie, csrf, invoke, save, sent, scheduler, now: () => clock, advance: (ms: number) => { clock += ms; }, notes: (value: typeof notes) => { notes = value; }, read: (fn: () => Promise<any>) => { read = fn; }, send: (fn: (...args: any[]) => Promise<any>) => { send = fn; }, calls: () => calls };
}

test('push keys are durable, encrypted, generated once atomically, and need only existing account configuration', async () => {
  const store = memoryStore();
  await expect(getPushKeys(store, config)).rejects.toMatchObject({ code: 'push_unavailable' }); expect(store.records.size).toBe(0);
  const keys = await Promise.all(Array.from({ length: 8 }, () => getPushKeys(store, config, true)));
  expect(new Set(keys.map((entry) => entry.publicKey)).size).toBe(1); expect(store.records.size).toBe(1);
  expect(keys[0].subject).toBe(env.HOYOLAB_APP_ORIGIN);
  expect(JSON.stringify([...store.records.values()])).not.toContain(keys[0].privateKey);
  const [key, record] = [...store.records.entries()][0]; expect(unseal(record.data, config.key, key)).toMatchObject({ publicKey: keys[0].publicKey });
  expect((await getPushKeys(store, config)).publicKey).toBe(keys[0].publicKey);
  const rotated = { ...config, key: Buffer.from('cd'.repeat(32), 'hex') };
  await expect(getPushKeys(store, rotated)).rejects.toMatchObject({ code: 'push_unavailable' });
  expect((await getPushKeys(store, rotated, true)).publicKey).not.toBe(keys[0].publicKey);
});

test('subscription validation rejects SSRF, foreign destinations, URL injection and malformed cryptographic keys', () => {
  expect(validatePushSubscription(subscription)).toEqual(subscription);
  for (const endpoint of ['http://127.0.0.1/x', 'https://169.254.169.254/metadata', 'https://evil.test/x', 'https://fcm.googleapis.com.evil.test/fcm/send/x', 'https://user:pass@fcm.googleapis.com/fcm/send/x', 'https://fcm.googleapis.com:444/fcm/send/x', 'https://web.push.apple.com/test?redirect=https://evil.test']) expect(() => validatePushSubscription({ ...subscription, endpoint })).toThrow();
  for (const endpoint of ['https://updates.push.services.mozilla.com/wpush/v2/fixture', 'https://web.push.apple.com/test/fixture', 'https://wns2-test.notify.windows.com/w/?token=fixture']) expect(validatePushSubscription({ ...subscription, endpoint }).endpoint).toBe(endpoint);
  expect(() => validatePushSubscription({ ...subscription, keys: { auth: 'short', p256dh: userKeys.publicKey } })).toThrow();
});

test('status is read-only and key generation/alarms require CSRF, origin and owned UID before accessing push storage', async () => {
  const api = await setup(); expect(await (await api.invoke('push-status')).json()).toEqual({ alarm: null }); expect(api.pushes.records.size).toBe(0);
  const payload = { action: 'push-prepare', uid: role.uid };
  for (const request of [api.request(payload, api.cookie), api.request(payload, api.cookie, api.csrf, { Origin: 'https://evil.test' }), api.request({ ...payload, uid: '800000002' }, api.cookie, api.csrf), api.request({ ...payload, endpoint: 'https://evil.test' }, api.cookie, api.csrf)]) expect([400, 403]).toContain((await api.handler(request)).status);
  expect(api.pushes.records.size).toBe(0);
  const prepared = await api.invoke('push-prepare'); expect(prepared.status).toBe(200); expect(prepared.headers.get('cache-control')).toContain('no-store');
  const body = await prepared.json(); expect(Object.keys(body)).toEqual(['publicKey']); expect(body.publicKey).toHaveLength(87);
});

test('push-save is idempotent, returns only safe display fields, and saves neither duplicated login credentials nor plaintext subscriptions', async () => {
  const api = await setup(), requestId = randomUUID();
  const response = await api.save({ requestId }); expect(response.status).toBe(200);
  const { alarm } = await response.json(); expect(alarm).toMatchObject({ target: 40, state: 'armed', tag: expect.stringMatching(/^resin-[a-f\d]{24}$/) });
  expect(alarm.dueAt).toBe(pushDueAt({ resin: 20, maxResin: 200, recoverySeconds: 180 * 480 - 120 }, 40, api.now()));
  expect(JSON.stringify([...api.pushes.records.values()])).not.toContain(role.uid); expect(JSON.stringify([...api.pushes.records.values()])).not.toContain(subscription.endpoint);
  const record = [...api.pushes.records.entries()].find(([, entry]) => entry.metadata.kind === 'alarm')!;
  expect(unseal(record[1].data, config.key, record[0])).not.toHaveProperty('credentials');
  expect((await api.save({ requestId })).status).toBe(200); expect(api.calls()).toBe(1);
  const status = await (await api.invoke('push-status')).json(); expect(status).toEqual({ alarm }); expect(JSON.stringify(status)).not.toContain(subscription.endpoint);
});

test('scheduler rechecks actual resin, reschedules spending, and sends once without account identifiers or an email subject', async () => {
  const api = await setup(); await api.save(); await api.scheduler(); expect(api.sent).toHaveLength(0);
  api.advance(20 * 480000); api.notes({ resin: 10, maxResin: 200, recoverySeconds: 190 * 480 }); await api.scheduler(); expect(api.sent).toHaveLength(0);
  expect((await (await api.invoke('push-status')).json()).alarm.dueAt).toBe(api.now() + 30 * 480000);
  api.advance(30 * 480000); api.notes({ resin: 41, maxResin: 200, recoverySeconds: 159 * 480 }); await Promise.all([api.scheduler(), api.scheduler()]);
  expect(api.sent).toHaveLength(1);
  const [destination, payload, options] = api.sent[0]; expect(destination).toEqual(subscription); expect(JSON.parse(payload).body).toContain('41 (target 40)');
  expect(payload).not.toContain(role.uid); expect(payload).not.toContain(role.nickname); expect(payload).not.toContain('FAKE-test-token');
  expect(options.vapidDetails.subject).toBe(env.HOYOLAB_APP_ORIGIN); expect(options).toMatchObject({ TTL: 300, timeout: 8000 });
  expect((await (await api.invoke('push-status')).json()).alarm.state).toBe('delivered');
  await api.scheduler(); expect(api.sent).toHaveLength(1);
});

test('cancellation/disconnect during a slow scheduled read wins, and expiry disables delivery', async () => {
  for (const mode of ['cancel', 'disconnect', 'expiry']) {
    const api = await setup(); api.notes({ resin: 40, maxResin: 200, recoverySeconds: 160 * 480 }); await api.save();
    if (mode === 'expiry') { api.advance(86400001); await api.scheduler(); expect(api.sent).toHaveLength(0); continue; }
    let release!: () => void, started!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; }), ready = new Promise<void>((resolve) => { started = resolve; });
    api.read(async () => { started(); await gate; return { resin: 40, maxResin: 200, recoverySeconds: 160 * 480 }; });
    const pending = api.scheduler(); await ready;
    if (mode === 'cancel') expect((await api.invoke('push-remove')).status).toBe(200);
    else await api.handler(api.request(undefined, api.cookie, api.csrf, {}, 'DELETE'));
    release(); await pending; expect(api.sent).toHaveLength(0);
  }
});

test('cancelling an empty alarm slot blocks a slow first save, while an explicitly new save can re-arm afterward', async () => {
  const api = await setup(); const prepared = await (await api.invoke('push-prepare')).json();
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }), ready = new Promise<void>((resolve) => { started = resolve; });
  api.read(async () => { started(); await gate; return { resin: 40, maxResin: 200, recoverySeconds: 160 * 480 }; });
  const pending = api.invoke('push-save', { target: 40, subscription, publicKey: prepared.publicKey, requestId: randomUUID() });
  await ready; expect((await api.invoke('push-remove')).status).toBe(200); release(); expect((await pending).status).toBe(409);
  expect(await (await api.invoke('push-status')).json()).toEqual({ alarm: null }); await api.scheduler(); expect(api.sent).toHaveLength(0);
  expect((await api.save()).status).toBe(200);
});

test('unavailable push endpoints stop, temporary errors back off, and deploy previews cannot send', async () => {
  const api = await setup(); api.notes({ resin: 40, maxResin: 200, recoverySeconds: 160 * 480 }); await api.save();
  api.send(async () => { throw new Error('PRIVATE_PUSH_ENDPOINT'); }); await api.scheduler();
  expect((await (await api.invoke('push-status')).json()).alarm.dueAt).toBe(api.now() + 300000);
  api.advance(300001); api.send(async () => { throw { statusCode: 410 }; }); await api.scheduler();
  expect((await (await api.invoke('push-status')).json()).alarm.state).toBe('unavailable');
  await createResinScheduler({ env: { ...env, CONTEXT: 'deploy-preview' }, send: () => { throw new Error('must never send'); } })();
});

test('runtime deployment metadata enables published alarms without a build-only CONTEXT variable and blocks previews/old deploys', async () => {
  const api = await setup(); api.notes({ resin: 40, maxResin: 200, recoverySeconds: 160 * 480 }); await api.save();
  const scheduler = createResinScheduler({ env: { ...env, CONTEXT: undefined }, now: api.now, sessionStoreFactory: () => api.sessions, pushStoreFactory: () => api.pushes, provider: { notes: async () => ({ resin: 40, maxResin: 200, recoverySeconds: 160 * 480 }) }, send: async () => { api.sent.push('runtime push'); } });
  await scheduler(undefined, { deploy: { context: 'deploy-preview', published: false } }); expect(api.sent).toHaveLength(0);
  await scheduler(undefined, { deploy: { context: 'production', published: false } }); expect(api.sent).toHaveLength(0);
  await scheduler(undefined, { deploy: { context: 'production', published: true } }); expect(api.sent).toHaveLength(1);
  const handler = createProfileHandler({ env: { ...env, CONTEXT: undefined }, storeFactory: () => api.sessions, pushStoreFactory: () => api.pushes });
  const request = () => api.request({ action: 'push-status', uid: role.uid }, api.cookie, api.csrf);
  expect((await handler(request(), { deploy: { context: 'production', published: true } })).status).toBe(200);
  expect((await handler(request(), { deploy: { context: 'deploy-preview', published: false } })).status).toBe(503);
});

test('push-mode browser alarms do not read resin or duplicate OS delivery and restored status survives page navigation', async () => {
  const alarm = { target: 40, state: 'armed' as const, dueAt: 1, expiresAt: Date.now() + 100000, tag: 'resin-' + 'a'.repeat(24) };
  let reads = 0, native = 0;
  const manager = createLocalResinAlarms({ read: async () => { throw new Error('push mode must not read notes'); }, readPush: async () => { reads++; return alarm; }, notify: async () => { native++; } });
  manager.restorePush(role.uid, 'c'.repeat(43), alarm);
  manager.receivedPush(alarm.tag, 'Hey Traveler! Your Original Resin is now 40.');
  expect(manager.getSnapshot().notice?.ready).toBe(true); expect(manager.getSnapshot().alarms[0].state).toBe('delivered');
  manager.receivedPush(alarm.tag, 'duplicate'); await manager.checkDue(); expect(reads).toBe(0); expect(native).toBe(0);
});

test('worker upgrades immediately, shows Paimon for push, informs open windows and rejects malformed payloads', async () => {
  const handlers: Record<string, any> = {}, shown: any[] = [], posted: any[] = [], promises: Promise<any>[] = [];
  let skipped = 0, claimed = 0;
  const self = { addEventListener: (name: string, fn: any) => { handlers[name] = fn; }, skipWaiting: async () => { skipped++; }, registration: { showNotification: async (...args: any[]) => { shown.push(args); } }, clients: { claim: async () => { claimed++; }, matchAll: async () => [{ postMessage: (message: any) => posted.push(message) }] } };
  runInNewContext(readFileSync('public/resin-worker.js', 'utf8'), { self });
  const waitUntil = (promise: Promise<any>) => promises.push(promise);
  handlers.install({ waitUntil }); handlers.activate({ waitUntil });
  handlers.push({ data: { json: () => ({ body: 'Hey Traveler! Your Original Resin is now 40.', tag: 'resin-' + 'a'.repeat(24) }) }, waitUntil });
  await Promise.all(promises); expect(skipped).toBe(1); expect(claimed).toBe(1);
  expect(shown[0][1]).toMatchObject({ icon: '/paimon/face.png', data: { path: '/me' } }); expect(posted[0].type).toBe('resin-delivered');
  handlers.push({ data: { json: () => { throw new Error('invalid'); } }, waitUntil }); expect(shown).toHaveLength(1); expect(handlers).not.toHaveProperty('fetch');
});
