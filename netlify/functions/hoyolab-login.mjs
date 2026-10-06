import { getStore } from '@netlify/blobs';
import { createHoyolabProvider, ConnectionError } from '../lib/hoyolab-provider.mjs';
import { createLoginProvider, encryptedCredentials, captchaProof } from '../lib/hoyolab-login.mjs';
import { checkRequest, configuration, connectedSession, cookieToken, digest, json, randomToken, requestBody, seal, STORE, unseal } from '../lib/profile-security.mjs';

export const LOGIN_COOKIE = '__Host-teyvat-login';
const LOGIN_MS = 5 * 60_000;
const bindingCookie = (token) => `${LOGIN_COOKIE}=${token ?? ''}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token ? LOGIN_MS / 1000 : 0}`;
function binding(request) {
  const values = (request.headers.get('cookie') ?? '').split(';').map((item) => item.trim()).filter((item) => item.startsWith(`${LOGIN_COOKIE}=`));
  return values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0].slice(LOGIN_COOKIE.length + 1)) ? values[0].slice(LOGIN_COOKIE.length + 1) : null;
}

export function createLoginHandler({ storeFactory = () => getStore({ name: STORE, consistency: 'strong' }), loginProvider = createLoginProvider(), profileProvider = createHoyolabProvider(), env = process.env, now = Date.now } = {}) {
  const attempts = new Map();
  function throttle(client) {
    const time = now();
    for (const [id, value] of attempts) if (time - value.start >= 600_000) attempts.delete(id);
    if (!attempts.has(client) && attempts.size >= 2000) throw new ConnectionError('rate_limited', 429);
    const entry = attempts.get(client) ?? { count: 0, start: time };
    entry.count++; attempts.set(client, entry);
    if (entry.count > 8) throw new ConnectionError('rate_limited', 429);
  }
  return async (request, context = {}) => {
    try {
      const config = configuration(env);
      if (!config || env.HOYOLAB_DIRECT_LOGIN === 'false') throw new ConnectionError('not_configured', 503);
      if (!['POST', 'DELETE'].includes(request.method)) return json({ code: 'invalid_request' }, 405, { Allow: 'POST, DELETE' });
      if (new URL(request.url).search) throw new ConnectionError('invalid_request', 400);
      checkRequest(request, config.origin);
      if (request.method === 'DELETE') return json({ cancelled: true }, 200, { 'Set-Cookie': bindingCookie(null) });
      throttle(context.ip ?? 'unknown');
      const payload = await requestBody(request);
      const allowed = ['action', 'account', 'password', 'consent', ...(payload.action === 'verify' ? ['ticket', 'proof'] : [])];
      if (!['login', 'verify'].includes(payload.action) || Object.keys(payload).some((name) => !allowed.includes(name))) throw new ConnectionError('invalid_request', 400);
      if (payload.consent !== true) throw new ConnectionError('consent_required', 400);
      const encrypted = encryptedCredentials(payload);
      const store = storeFactory();
      const existing = cookieToken(request);
      if (existing && await store.getMetadata(`${digest(config.origin)}/${digest(existing)}`)) throw new ConnectionError('already_connected', 400);
      const aad = `${config.origin}:hoyolab-login`;
      let deviceId = loginProvider.deviceId();
      let challenge;
      let expiresAt = now() + LOGIN_MS;
      if (payload.action === 'verify') {
        const cookie = binding(request);
        if (!cookie || typeof payload.ticket !== 'string' || payload.ticket.length > 5000 || !/^[A-Za-z0-9_-]+$/.test(payload.ticket)) throw new ConnectionError('login_expired', 401);
        let state;
        try { state = unseal(JSON.parse(Buffer.from(payload.ticket, 'base64url').toString()), config.key, aad); }
        catch { throw new ConnectionError('login_expired', 401); }
        if (state.expiresAt <= now() || state.binding !== digest(cookie) || state.credentials !== digest(JSON.stringify(encrypted))) throw new ConnectionError('login_expired', 401);
        deviceId = state.deviceId; challenge = state.challenge; expiresAt = state.expiresAt;
        captchaProof(challenge, payload.proof); // Validate before consuming the one-use challenge.
        const used = await store.setJSON(`login-used/${digest(config.origin)}/${state.id}`, { used: true }, { onlyIfNew: true, metadata: { expiresAt } });
        if (used.modified === false) throw new ConnectionError('login_expired', 401);
      }
      const result = await loginProvider.login(encrypted, deviceId, challenge, payload.proof);
      if (request.signal.aborted) throw new ConnectionError('login_cancelled', 400);
      if (now() >= expiresAt) throw new ConnectionError('login_expired', 401);
      if (result.challenge) {
        const cookie = randomToken();
        const state = { id: randomToken(), deviceId, challenge: result.challenge, binding: digest(cookie), credentials: digest(JSON.stringify(encrypted)), expiresAt };
        const ticket = Buffer.from(JSON.stringify(seal(state, config.key, aad))).toString('base64url');
        return json({ challenge: result.challenge, ticket, expiresAt }, 200, { 'Set-Cookie': bindingCookie(cookie) });
      }
      const roles = await profileProvider.roles(result.credentials);
      if (request.signal.aborted) throw new ConnectionError('login_cancelled', 400);
      if (now() >= expiresAt) throw new ConnectionError('login_expired', 401);
      const connected = await connectedSession(store, config, result.credentials, roles, now);
      if (request.signal.aborted) { await store.delete(connected.key); throw new ConnectionError('login_cancelled', 400); }
      const response = json({ available: true, directLogin: true, connected: true, roles, csrf: connected.session.csrf, expiresAt: connected.session.expiresAt }, 200, { 'Set-Cookie': connected.cookie });
      response.headers.append('Set-Cookie', bindingCookie(null));
      return response;
    } catch (error) {
      const known = error instanceof ConnectionError;
      return json({ code: known ? error.code : 'login_unavailable' }, known ? error.status : 503, { 'Set-Cookie': bindingCookie(null), ...(error?.status === 429 ? { 'Retry-After': '600' } : {}) });
    }
  };
}
export default createLoginHandler();
// Netlify's platform window is limited to 180 seconds. The bounded warm-instance
// throttle above additionally limits attempts over ten minutes.
export const config = { path: '/api/hoyolab-login', rateLimit: { windowLimit: 8, windowSize: 180, aggregateBy: ['ip', 'domain'] } };
