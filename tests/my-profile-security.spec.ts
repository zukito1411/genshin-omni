import { expect, test } from '@playwright/test';
import { createProfileHandler } from '../netlify/functions/my-profile.mjs';
import { COOKIE, configuration, seal, SESSION_MS, unseal } from '../netlify/lib/profile-security.mjs';
import { boundedJson, ConnectionError, createHoyolabProvider } from '../netlify/lib/hoyolab-provider.mjs';
import { imageUrl, normalizeBuild, normalizeProfile, normalizeRoles } from '../netlify/lib/hoyolab-data.mjs';

const origin = 'https://app.test';
const key = 'ab'.repeat(32); // Test fixture, never a deployment secret.
const env = { HOYOLAB_ENABLED: 'true', HOYOLAB_ENCRYPTION_KEY: key, HOYOLAB_APP_ORIGIN: origin, CONTEXT: 'production' };
const token = 'test-session-token-for-fixtures-only';
const role = { uid: '800000001', nickname: 'Private Traveler', region: 'os_asia', server: 'Asia', level: 60 };
const profile = { role, characters: [{ id: 10000002, name: 'Kamisato Ayaka' }], updatedAt: 1 };
function setup(customProvider?: object, artworkProvider?: object) {
  const records = new Map();
  const metadata = new Map();
  const store = {
    get: async (id: string) => records.get(id) ?? null,
    getMetadata: async (id: string) => records.has(id) ? { metadata: metadata.get(id) } : null,
    setJSON: async (id: string, data: object, options: any) => { records.set(id, structuredClone(data)); metadata.set(id, options.metadata); return { modified: true }; },
    delete: async (id: string) => { records.delete(id); metadata.delete(id); },
  };
  let clock = Date.now();
  let calls = 0;
  const provider = customProvider ?? { roles: async () => [role], profile: async () => { calls++; return profile; }, character: async () => ({ name: 'Kamisato Ayaka' }) };
  const handler = createProfileHandler({ storeFactory: () => store, env, provider, ...(artworkProvider ? { artworkProvider } : {}), now: () => clock });
  const request = (method: string, payload?: object, cookie?: string, csrf?: string, extra = {}) => new Request(`${origin}/api/my-profile`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Teyvat-Client': 'profile', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-Teyvat-CSRF': csrf } : {}), ...extra }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  async function connect() {
    const response = await handler(request('POST', { action: 'connect', accountId: '12345', token, version: 'v2', consent: true }), { ip: 'test-client' });
    expect(response.status).toBe(200);
    return { cookie: response.headers.get('set-cookie')!.split(';')[0], csrf: (await response.json()).csrf, response };
  }
  return { records, store, handler, request, connect, callCount: () => calls, advance: (amount: number) => { clock += amount; } };
}

test('private sessions use authenticated encryption, origin/key binding and fail-closed configuration', () => {
  const data = { secret: token };
  const encrypted = seal(data, Buffer.from(key, 'hex'), 'session-key');
  expect(JSON.stringify(encrypted)).not.toContain(token);
  expect(unseal(encrypted, Buffer.from(key, 'hex'), 'session-key')).toEqual(data);
  expect(() => unseal(encrypted, Buffer.from(key, 'hex'), 'other-session')).toThrow();
  expect(() => unseal(encrypted, Buffer.from('cd'.repeat(32), 'hex'), 'session-key')).toThrow();
  expect(() => unseal({ ...encrypted, data: Buffer.from('tampered').toString('base64') }, Buffer.from(key, 'hex'), 'session-key')).toThrow();
  expect(configuration(env)).toBeTruthy();
  for (const bad of [{ ...env, CONTEXT: 'deploy-preview' }, { ...env, HOYOLAB_APP_ORIGIN: 'http://app.test' }, { ...env, HOYOLAB_ENCRYPTION_KEY: 'too-short' }, { ...env, HOYOLAB_ENABLED: 'false' }]) expect(configuration(bad)).toBeNull();
});

test('connection requires consent and gives only an opaque secure cookie and display fields', async () => {
  const api = setup();
  expect((await api.handler(api.request('GET'))).status).toBe(200);
  expect((await api.handler(api.request('POST', { action: 'connect', accountId: '12345', token, version: 'v2', consent: false }))).status).toBe(400);
  const connected = await api.connect();
  expect(connected.response.headers.get('set-cookie')).toMatch(/HttpOnly; Secure; SameSite=Strict/);
  expect(connected.cookie).toMatch(new RegExp(`^${COOKIE}=[A-Za-z0-9_-]{43}$`));
  const serialized = JSON.stringify([...api.records.values()]);
  expect(serialized).not.toContain(token);
  expect(serialized).not.toContain(role.nickname);
  const status = await api.handler(api.request('GET', undefined, connected.cookie));
  const body = await status.json();
  expect(body.roles).toEqual([role]);
  expect(JSON.stringify(body)).not.toContain(token);
  expect(status.headers.get('cache-control')).toContain('no-store');
  expect(status.headers.get('netlify-cdn-cache-control')).toBe('no-store');
});

test('CSRF, origin, ownership and arbitrary-query guards apply before private provider calls', async () => {
  const api = setup();
  const connected = await api.connect();
  const payload = { action: 'profile', uid: role.uid };
  for (const request of [
    api.request('POST', payload, connected.cookie),
    api.request('POST', payload, connected.cookie, 'z'.repeat(43)),
    api.request('POST', payload, connected.cookie, connected.csrf, { Origin: 'https://evil.test' }),
    api.request('POST', payload, connected.cookie, connected.csrf, { Origin: 'http://app.test' }),
    api.request('POST', payload, connected.cookie, connected.csrf, { 'Sec-Fetch-Site': 'cross-site' }),
    api.request('POST', { action: 'profile', uid: '800000999' }, connected.cookie, connected.csrf),
    api.request('POST', { ...payload, url: 'http://127.0.0.1/private' }, connected.cookie, connected.csrf),
  ]) expect([400, 403]).toContain((await api.handler(request)).status);
  expect(api.callCount()).toBe(0);
  expect((await api.handler(new Request(`${origin}/api/my-profile?uid=800000999`))).status).toBe(400);
  const valid = await api.handler(api.request('POST', payload, connected.cookie, connected.csrf));
  expect(valid.status).toBe(200);
  expect((await valid.json()).profile.role.uid).toBe(role.uid);
  expect((await api.handler(api.request('POST', { action: 'character', uid: role.uid, characterId: 999 }, connected.cookie, connected.csrf))).status).toBe(403);
  expect((await api.handler(api.request('POST', { action: 'character', uid: role.uid, characterId: 10000002 }, connected.cookie, connected.csrf))).status).toBe(200);
});

test('disconnect and expiry revoke replayed sessions and never overwrite player-local saves', async () => {
  const api = setup();
  const connected = await api.connect();
  const payload = { action: 'profile', uid: role.uid };
  await api.handler(api.request('POST', payload, connected.cookie, connected.csrf));
  await api.handler(api.request('POST', payload, connected.cookie, connected.csrf));
  expect(api.callCount()).toBe(1);
  expect((await api.handler(api.request('DELETE', undefined, connected.cookie))).status).toBe(403);
  const removed = await api.handler(api.request('DELETE', undefined, connected.cookie, connected.csrf));
  expect(removed.status).toBe(200);
  expect(removed.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(api.records.size).toBe(0);
  expect((await api.handler(api.request('POST', payload, connected.cookie, connected.csrf))).status).toBe(401);
  const again = await api.connect();
  api.advance(SESSION_MS + 1);
  expect((await api.handler(api.request('GET', undefined, again.cookie))).status).toBe(200);
  expect(api.records.size).toBe(0);
  expect((await api.handler(api.request('POST', payload, again.cookie, again.csrf))).status).toBe(401);
});

test('in-flight profile results cannot be delivered after disconnect revokes their session', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const api = setup({ roles: async () => [role], profile: async () => { started(); await gate; return profile; } });
  const connected = await api.connect();
  const pending = api.handler(api.request('POST', { action: 'profile', uid: role.uid }, connected.cookie, connected.csrf));
  await ready;
  await api.handler(api.request('DELETE', undefined, connected.cookie, connected.csrf));
  release();
  expect((await pending).status).toBe(401);
  expect(api.records.size).toBe(0);
});

test('independent users have isolated profile caches, and spoofed IP headers do not bypass throttles', async () => {
  const api = setup();
  const one = await api.connect();
  const two = await api.connect();
  expect(one.cookie).not.toBe(two.cookie);
  for (const connection of [one, two]) expect((await api.handler(api.request('POST', { action: 'profile', uid: role.uid }, connection.cookie, connection.csrf))).status).toBe(200);
  expect(api.callCount()).toBe(2);
  for (let i = 0; i < 30; i++) await api.handler(api.request('GET', undefined, undefined, undefined, { 'X-Forwarded-For': `fake-${i}` }), { ip: 'same-client' });
  const limited = await api.handler(api.request('GET'), { ip: 'same-client' });
  expect(limited.status).toBe(429);
  expect(limited.headers.get('retry-after')).toBe('60');
});

test('raw errors, malformed credentials, oversize bodies and missing storage fail without leaking secrets', async () => {
  const api = setup({ roles: async () => { throw new Error(`upstream secret ${token}`); } });
  const result = await api.handler(api.request('POST', { action: 'connect', accountId: '123', token, version: 'v2', consent: true }));
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain(token);
  const oversized = await api.handler(api.request('POST', { action: 'connect', token: 'x'.repeat(10_000) }));
  expect(oversized.status).toBe(400);
  const injection = await api.handler(api.request('POST', { action: 'connect', accountId: '123', token: 'x'.repeat(30) + '; another_cookie=secret', version: 'v2', consent: true }));
  expect(injection.status).toBe(400);
  const disabled = createProfileHandler({ env: {} });
  expect(await (await disabled(api.request('GET'))).json()).toMatchObject({ available: false, connected: false });
  expect((await disabled(api.request('POST', { action: 'connect' }))).status).toBe(503);
  await expect(boundedJson(new Response('x'.repeat(1000)), 10)).rejects.toThrow();
});

test('HoYoLAB normalization excludes credentials, arbitrary images and raw metadata while preserving zero resin', () => {
  expect(imageUrl('https://evil.test/tracker.png')).toBe('');
  expect(imageUrl('https://hoyolab.com.evil.test/image.png')).toBe('');
  expect(imageUrl('https://upload-os-bbs.hoyolab.com/image.png?token=secret')).toBe('');
  expect(imageUrl('https://upload-os-bbs.hoyolab.com/image.png')).toContain('image.png');
  expect(normalizeRoles({ list: [{ game_biz: 'hk4e_global', game_uid: '800000001', region: 'os_asia', nickname: 'Traveler' }, { game_biz: 'hkrpg_global', game_uid: '800000001' }] })).toHaveLength(1);
  const data = normalizeProfile(role, { stats: { achievement_number: 0, active_day_number: 0 }, token }, { current_resin: 0, max_resin: 200, resin_recovery_time: '100', finished_task_num: 0, total_task_num: 4, token }, { list: [] }, 1, []);
  expect(data.notes.resin).toBe(0);
  expect(data.stats.achievements).toBe(0);
  expect(JSON.stringify(data)).not.toContain(token);
  expect(normalizeBuild({ list: [] }, 1)).toBeNull();
});

test('a cancelled body reader releases a stalled stream without continuing to parse or save credentials', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull: () => new Promise(() => {}), cancel: () => { cancelled = true; } });
  const controller = new AbortController();
  const read = boundedJson(new Response(stream), 6000, controller.signal);
  controller.abort();
  await expect(read).rejects.toMatchObject({ code: 'invalid_request', status: 408 });
  expect(cancelled).toBe(true);
});

test('provider requests are fixed-host, ownership-based, bounded and never auto-enable privacy settings', async () => {
  const calls: any[] = [];
  const fetcher = async (url: string, options: any) => {
    calls.push({ url, options });
    return Response.json({ retcode: 0, data: url.includes('binding') ? { list: [{ game_biz: 'hk4e_global', game_uid: role.uid, region: 'os_asia', nickname: role.nickname }] } : url.includes('dailyNote') ? { current_resin: 40, max_resin: 200, resin_recovery_time: '72000' } : url.includes('character/list') ? { list: [{ id: 10000002, name: 'Kamisato Ayaka', level: 90 }] } : { stats: {} } });
  };
  const provider = createHoyolabProvider(fetcher);
  const credentials = { accountId: '123', token, version: 'v2' };
  expect(await provider.roles(credentials)).toHaveLength(1);
  const data = await provider.profile(credentials, role);
  expect(data.notes.resin).toBe(40);
  expect(data.characters[0].name).toBe('Kamisato Ayaka');
  expect(calls.every((call) => call.options.redirect === 'error')).toBe(true);
  expect(calls[0].options.headers.Cookie).toContain('ltoken_v2=');
  expect(calls.some((call) => call.url.includes('changeDataSwitch'))).toBe(false);
  const challenge = createHoyolabProvider(async () => Response.json({ retcode: 1034, data: null }));
  await expect(challenge.roles(credentials)).rejects.toBeInstanceOf(ConnectionError);
});

test('connected artwork requires the same ownership and CSRF checks without reading or forwarding private profile data', async () => {
  const calls: string[] = [];
  const api = setup(undefined, { get: async (...args: string[]) => { calls.push(...args); return { uid: args[0], avatar: 'UI_AvatarIcon_Ayaka.png', namecard: 'UI_NameCardPic_Ambor_P.jpg' }; } });
  const connected = await api.connect();
  for (const request of [api.request('POST', { action: 'artwork', uid: role.uid }, connected.cookie), api.request('POST', { action: 'artwork', uid: '800000999' }, connected.cookie, connected.csrf), api.request('POST', { action: 'artwork', uid: role.uid, url: 'https://evil.test' }, connected.cookie, connected.csrf)]) expect([400, 403]).toContain((await api.handler(request)).status);
  expect(calls).toEqual([]);
  const response = await api.handler(api.request('POST', { action: 'artwork', uid: role.uid }, connected.cookie, connected.csrf));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(calls).toEqual([role.uid]);
  expect(api.callCount()).toBe(0);
  const body = await response.json();
  expect(Object.keys(body.artwork).sort()).toEqual(['avatar', 'namecard', 'uid']);
  expect(JSON.stringify(body)).not.toContain(token);
});

test('late artwork replies cannot revive a disconnected profile', async () => {
  let release: ((value: object) => void) | undefined;
  let start: (() => void) | undefined;
  const called = new Promise<void>((resolve) => { start = resolve; });
  const pending = new Promise<object>((resolve) => { release = resolve; });
  const api = setup(undefined, { get: async () => { start?.(); return pending; } });
  const connected = await api.connect();
  const response = api.handler(api.request('POST', { action: 'artwork', uid: role.uid }, connected.cookie, connected.csrf));
  await called;
  await api.handler(api.request('DELETE', undefined, connected.cookie, connected.csrf));
  release?.({ uid: role.uid, avatar: 'UI_AvatarIcon_Ayaka.png', namecard: 'UI_NameCardPic_Ambor_P.jpg' });
  expect((await response).status).toBe(401);
});
