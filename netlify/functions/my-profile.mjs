import { getStore } from '@netlify/blobs';
import { createHoyolabProvider, ConnectionError, parseCredentials } from '../lib/hoyolab-provider.mjs';
import { checkRequest, configuration, connectedSession, cookieHeader, cookieToken, digest, equalTokens, json, requestBody, STORE, unseal } from '../lib/profile-security.mjs';

// Factory permits isolated security tests without real credentials or provider calls.
export function createProfileHandler({ storeFactory = () => getStore({ name: STORE, consistency: 'strong' }), provider = createHoyolabProvider(), env = process.env, now = Date.now } = {}) {
  const cache = new Map();
  const rate = new Map();
  function throttle(client) {
    const time = now();
    for (const [key, entry] of rate) if (time - entry.start >= 60_000) rate.delete(key);
    if (!rate.has(client) && rate.size >= 2000) throw new ConnectionError('rate_limited', 429);
    const value = rate.get(client) ?? { start: time, count: 0 };
    value.count++;
    rate.set(client, value);
    if (value.count > 30) throw new ConnectionError('rate_limited', 429);
  }
  async function cached(key, load, expiresAt) {
    const time = now();
    for (const [id, item] of cache) if (item.until <= time) cache.delete(id);
    let entry = cache.get(key);
    if (!entry) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      entry = { until: Math.min(time + 30_000, expiresAt), promise: Promise.resolve().then(load) };
      cache.set(key, entry);
      entry.promise.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
    }
    return entry.promise;
  }
  function clearCache(key) { for (const id of cache.keys()) if (id.startsWith(`${key}:`)) cache.delete(id); }
  return async (request, context = {}) => {
    let store, sessionKey;
    try {
      if (!['GET', 'POST', 'DELETE'].includes(request.method)) return json({ code: 'invalid_request' }, 405, { Allow: 'GET, POST, DELETE' });
      if (new URL(request.url).search) throw new ConnectionError('invalid_request', 400);
      const config = configuration(env);
      if (!config) return json({ available: false, connected: false, code: 'not_configured' }, request.method === 'GET' ? 200 : 503);
      checkRequest(request, config.origin);
      throttle(context.ip ?? 'unknown'); // Netlify context, never an incoming spoofable IP header.
      store = storeFactory();
      const token = cookieToken(request);
      sessionKey = token ? `${digest(config.origin)}/${digest(token)}` : null;
      let session = null;
      if (sessionKey) {
        const encrypted = await store.get(sessionKey, { type: 'json' });
        if (encrypted) {
          try { session = unseal(encrypted, config.key, sessionKey); } catch { throw new ConnectionError('reconnect', 401); }
          if (session.origin !== config.origin || !Number.isFinite(session.expiresAt) || session.expiresAt <= now()) {
            await store.delete(sessionKey); clearCache(sessionKey); session = null;
          }
        }
      }
      const status = (value) => ({ available: true, directLogin: env.HOYOLAB_DIRECT_LOGIN !== 'false', connected: Boolean(value), ...(value ? { roles: value.roles, csrf: value.csrf, expiresAt: value.expiresAt } : {}) });
      if (request.method === 'GET') return json(status(session), 200, sessionKey && !session ? { 'Set-Cookie': cookieHeader(null) } : {});
      if (request.method === 'DELETE') {
        if (session && !equalTokens(request.headers.get('x-teyvat-csrf'), session.csrf)) throw new ConnectionError('forbidden', 403);
        if (sessionKey) { await store.delete(sessionKey); clearCache(sessionKey); }
        return json(status(null), 200, { 'Set-Cookie': cookieHeader(null) });
      }
      const payload = await requestBody(request);
      const allowed = payload.action === 'connect' ? ['action', 'accountId', 'token', 'version', 'consent'] : payload.action === 'profile' ? ['action', 'uid'] : ['action', 'uid', 'characterId'];
      if (Object.keys(payload).some((key) => !allowed.includes(key))) throw new ConnectionError('invalid_request', 400);
      if (payload.action === 'connect') {
        if (payload.consent !== true || session) throw new ConnectionError(session ? 'already_connected' : 'consent_required', 400);
        const credentials = parseCredentials(payload);
        const roles = await provider.roles(credentials); // Ownership is from HoYoLAB, not a submitted UID.
        const result = await connectedSession(store, config, credentials, roles, now);
        return json(status(result.session), 200, { 'Set-Cookie': result.cookie });
      }
      if (!session) throw new ConnectionError('reconnect', 401);
      if (!equalTokens(request.headers.get('x-teyvat-csrf'), session.csrf)) throw new ConnectionError('forbidden', 403);
      if (!['profile', 'character'].includes(payload.action)) throw new ConnectionError('invalid_request', 400);
      const role = session.roles.find((entry) => entry.uid === payload.uid);
      if (!role) throw new ConnectionError('forbidden', 403);
      const profile = await cached(`${sessionKey}:${role.uid}:profile`, () => provider.profile(session.credentials, role), session.expiresAt);
      async function ensureActive() {
        const entry = await store.getMetadata(sessionKey);
        if (!entry || session.expiresAt <= now()) throw new ConnectionError('reconnect', 401);
      }
      if (payload.action === 'profile') { await ensureActive(); return json({ profile }); }
      if (typeof payload.characterId !== 'number' || !Number.isSafeInteger(payload.characterId) || !profile.characters.some((entry) => entry.id === payload.characterId)) throw new ConnectionError('forbidden', 403);
      const character = await cached(`${sessionKey}:${role.uid}:${payload.characterId}`, () => provider.character(session.credentials, role, payload.characterId), session.expiresAt);
      await ensureActive();
      return json({ character });
    } catch (error) {
      const known = error instanceof ConnectionError;
      if (known && error.code === 'reconnect' && sessionKey && store) {
        try { await store.delete(sessionKey); clearCache(sessionKey); } catch { /* Fail closed; never log credentials. */ }
      }
      return json({ code: known ? error.code : 'unavailable' }, known ? error.status : 503, known && error.code === 'reconnect' ? { 'Set-Cookie': cookieHeader(null) } : error?.code === 'rate_limited' ? { 'Retry-After': '60' } : {});
    }
  };
}
export default createProfileHandler();
export const config = { path: '/api/my-profile', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
