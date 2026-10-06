import { expect, test } from '@playwright/test';
import { createLoginHandler, LOGIN_COOKIE } from '../netlify/functions/hoyolab-login.mjs';
import { createLoginProvider, encryptedCredentials, loginChallenge } from '../netlify/lib/hoyolab-login.mjs';
import { COOKIE, unseal } from '../netlify/lib/profile-security.mjs';

const origin = 'https://app.test';
const key = 'ab'.repeat(32);
const env = { HOYOLAB_ENABLED: 'true', HOYOLAB_APP_ORIGIN: origin, HOYOLAB_ENCRYPTION_KEY: key, CONTEXT: 'production' };
const encrypted = { account: Buffer.alloc(256, 1).toString('base64'), password: Buffer.alloc(256, 2).toString('base64') };
const credentials = { accountId: '12345', token: 'fixture-hoyolab-session-not-real', version: 'v2' };
const role = { uid: '800000001', region: 'os_asia', nickname: 'Fixture Traveler' };
const challenge = { version: 3, sessionId: 'hoyo-fixture-session', gt: 'a'.repeat(32), challenge: 'fixture-challenge', newCaptcha: true, offline: false };
const proof = { geetest_challenge: 'fixture-challenge', geetest_validate: 'fixture-validation', geetest_seccode: 'fixture-validation|jordan' };
function setup(challenged = false) {
  let time = Date.now();
  let calls = 0;
  const records = new Map(); const metadata = new Map();
  const store = {
    getMetadata: async (id: string) => records.has(id) ? { metadata: metadata.get(id) } : null,
    setJSON: async (id: string, data: object, options: any) => { if (options.onlyIfNew && records.has(id)) return { modified: false }; records.set(id, structuredClone(data)); metadata.set(id, options.metadata); return { modified: true }; },
  };
  const provider = { deviceId: () => 'test-device', login: async (_input: object, _device: string, previous: object) => { calls++; return challenged && !previous ? { challenge } : { credentials }; } };
  const handler = createLoginHandler({ env, now: () => time, storeFactory: () => store, loginProvider: provider, profileProvider: { roles: async () => [role] } });
  const request = (payload: object, cookie = '', headers = {}) => new Request(`${origin}/api/hoyolab-login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Teyvat-Client': 'profile', Cookie: cookie, ...headers }, body: JSON.stringify(payload) });
  return { handler, records, request, calls: () => calls, advance: () => { time += 300001; } };
}
test('direct login rejects plaintext, missing consent, injected fields and foreign origins before authentication', async () => {
  const api = setup();
  for (const payload of [
    { action: 'login', ...encrypted, consent: false },
    { action: 'login', account: 'email@example.invalid', password: 'fake-password', consent: true },
    { action: 'login', ...encrypted, consent: true, url: 'https://evil.test/' },
  ]) expect((await api.handler(api.request(payload))).status).toBe(400);
  expect((await api.handler(api.request({ action: 'login', ...encrypted, consent: true }, '', { Origin: 'https://evil.test' }))).status).toBe(403);
  expect(api.calls()).toBe(0);
  expect(() => encryptedCredentials({ account: 'a'.repeat(344), password: encrypted.password })).toThrow();
  const disabled = createLoginHandler({ env: { ...env, HOYOLAB_DIRECT_LOGIN: 'false' } });
  expect((await disabled(api.request({ action: 'login', ...encrypted, consent: true }))).status).toBe(503);
});
test('successful login stores only encrypted reading credentials and returns an opaque session', async () => {
  const api = setup();
  const response = await api.handler(api.request({ action: 'login', ...encrypted, consent: true }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.getSetCookie()[0]).toMatch(new RegExp(`^${COOKIE}=[A-Za-z0-9_-]{43};`));
  expect(response.headers.getSetCookie()[1]).toContain(`${LOGIN_COOKIE}=;`);
  const body = await response.json();
  expect(body.connected).toBe(true); expect(body.roles).toEqual([role]);
  expect(JSON.stringify(body)).not.toContain(credentials.token);
  expect(JSON.stringify([...api.records.values()])).not.toContain(credentials.token);
  const [id, record] = [...api.records][0];
  const stored = unseal(record, Buffer.from(key, 'hex'), id);
  expect(stored.credentials).toEqual(credentials);
  expect(JSON.stringify(stored)).not.toContain(encrypted.password);
  expect(JSON.stringify(stored)).not.toContain(encrypted.account);
});
test('CAPTCHA tickets are browser-bound, credential-bound, expire and cannot be replayed', async () => {
  const api = setup(true);
  const first = await api.handler(api.request({ action: 'login', ...encrypted, consent: true }));
  const pending = await first.json();
  const cookie = first.headers.get('set-cookie')!.split(';')[0];
  const verify = { action: 'verify', ...encrypted, consent: true, ticket: pending.ticket, proof };
  expect(pending.challenge).toEqual(challenge);
  expect(api.records.size).toBe(0); // No passwords, ciphertexts or pending sessions persisted.
  expect((await api.handler(api.request(verify))).status).toBe(401);
  expect((await api.handler(api.request({ ...verify, password: encrypted.account }, cookie))).status).toBe(401);
  expect((await api.handler(api.request({ ...verify, proof: { ...proof, arbitrary: 'unsafe' } }, cookie))).status).toBe(400);
  expect((await api.handler(api.request({ ...verify, ticket: pending.ticket.slice(0, -3) + 'abc' }, cookie))).status).toBe(401);
  expect(api.calls()).toBe(1);
  expect((await api.handler(api.request(verify, cookie))).status).toBe(200);
  expect((await api.handler(api.request(verify, cookie))).status).toBe(401);
  expect(api.calls()).toBe(2);
  const expired = setup(true);
  const started = await expired.handler(expired.request({ action: 'login', ...encrypted, consent: true }));
  const data = await started.json(); expired.advance();
  expect((await expired.handler(expired.request({ ...verify, ticket: data.ticket }, started.headers.get('set-cookie')!.split(';')[0]))).status).toBe(401);
});
test('provider uses the fixed global endpoint, forwards encrypted inputs, and drops powerful cookies', async () => {
  const requests: any[] = [];
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', `ltuid_v2=${credentials.accountId}; Secure; HttpOnly`);
  headers.append('Set-Cookie', `ltoken_v2=${credentials.token}; Secure; HttpOnly`);
  headers.append('Set-Cookie', 'cookie_token_v2=powerful-cookie-discarded; Secure; HttpOnly');
  const provider = createLoginProvider(async (url: string, options: object) => { requests.push({ url, ...options }); return Response.json({ retcode: 0, data: {}, message: 'do-not-display' }, { headers }); });
  expect(await provider.login(encrypted, 'fixture-device')).toEqual({ credentials });
  expect(requests[0].url).toBe('https://sg-public-api.hoyolab.com/account/ma-passport/api/webLoginByPassword');
  expect(requests[0].redirect).toBe('error');
  expect(JSON.parse(requests[0].body)).toEqual({ ...encrypted, token_type: 6 });
  expect(requests[0].headers.Cookie).toBeUndefined();
  await provider.login(encrypted, 'fixture-device', challenge, proof);
  expect(requests[1].headers['x-rpc-aigis']).toBe(`${challenge.sessionId};${Buffer.from(JSON.stringify(proof)).toString('base64')}`);
  expect(loginChallenge(JSON.stringify({ session_id: 'fixture', data: JSON.stringify({ gt: 'a'.repeat(32), challenge: 'challenge', new_captcha: 1, success: 1 }) })).version).toBe(3);
  expect(loginChallenge(JSON.stringify({ session_id: 'fixture', data: { gt: 'a'.repeat(32), risk_type: 'slide', success: 1 } })).version).toBe(4);
  expect(() => loginChallenge('{not-json')).toThrow();
});
test('upstream login errors never echo raw provider messages or retry passwords', async () => {
  for (const [retcode, code] of [[-3208, 'login_failed'], [-3202, 'login_locked'], [-3102, 'login_verification'], [1200, 'login_unavailable']] as const) {
    let calls = 0;
    const provider = createLoginProvider(async () => { calls++; return Response.json({ retcode, message: 'private-diagnostic-password', data: null }); });
    await expect(provider.login(encrypted, 'fixture')).rejects.toMatchObject({ code });
    expect(calls).toBe(1);
  }
});

test('simultaneous CAPTCHA replays authenticate once, and fake forwarding headers cannot bypass throttling', async () => {
  const api = setup(true);
  const first = await api.handler(api.request({ action: 'login', ...encrypted, consent: true }));
  const pending = await first.json();
  const cookie = first.headers.get('set-cookie')!.split(';')[0];
  const payload = { action: 'verify', ...encrypted, consent: true, ticket: pending.ticket, proof };
  const responses = await Promise.all([api.handler(api.request(payload, cookie)), api.handler(api.request(payload, cookie))]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  expect(api.calls()).toBe(2);
  const throttled = setup();
  for (let index = 0; index < 8; index++) expect((await throttled.handler(throttled.request({ action: 'login', ...encrypted, consent: true }, '', { 'X-Forwarded-For': `fake-${index}` }), { ip: 'trusted-ip' })).status).toBe(200);
  expect((await throttled.handler(throttled.request({ action: 'login', ...encrypted, consent: true }, '', { 'X-Forwarded-For': 'different' }), { ip: 'trusted-ip' })).status).toBe(429);
  expect(throttled.calls()).toBe(8);
});

test('v4 CAPTCHA proof uses only approved fields and the issued captcha ID', async () => {
  const calls: any[] = [];
  const provider = createLoginProvider(async (_url: string, options: any) => { calls.push(options); return Response.json({ retcode: -3208, data: null }); });
  const captcha = { version: 4, sessionId: 'fixture', gt: 'a'.repeat(32), riskType: 'slide' };
  const solution = { captcha_id: captcha.gt, lot_number: 'lot', pass_token: 'token', gen_time: '123456', captcha_output: 'output' };
  await expect(provider.login(encrypted, 'device', captcha, solution)).rejects.toMatchObject({ code: 'login_failed' });
  expect(calls[0].headers['x-rpc-aigis']).toBe(`fixture;${Buffer.from(JSON.stringify(solution)).toString('base64')}`);
  await expect(provider.login(encrypted, 'device', captcha, { ...solution, captcha_id: 'different' })).rejects.toMatchObject({ code: 'invalid_login' });
  expect(calls).toHaveLength(1);
});

test('a cancelled request cannot create a connection after a slow ownership check', async () => {
  let release: ((roles: object[]) => void) | undefined;
  let called: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { called = resolve; });
  const ownership = new Promise<object[]>((resolve) => { release = resolve; });
  let saved = false;
  const handler = createLoginHandler({ env, storeFactory: () => ({ setJSON: async () => { saved = true; return { modified: true }; } }), loginProvider: { deviceId: () => 'device', login: async () => ({ credentials }) }, profileProvider: { roles: async () => { called?.(); return ownership; } } });
  const controller = new AbortController();
  const request = new Request(`${origin}/api/hoyolab-login`, { method: 'POST', signal: controller.signal, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Teyvat-Client': 'profile' }, body: JSON.stringify({ action: 'login', ...encrypted, consent: true }) });
  const response = handler(request);
  await started; controller.abort(); release?.([role]);
  expect((await response).status).toBe(400);
  expect(saved).toBe(false);
});
