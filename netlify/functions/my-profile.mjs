import { getStore } from '@netlify/blobs';
import { createHoyolabProvider, ConnectionError, parseCredentials } from '../lib/hoyolab-provider.mjs';
import { createEnkaArtworkProvider } from '../lib/enka-artwork.mjs';
import { PUSH_STORE, getPushKeys, pushAlarmKey, pushDisplay, pushDueAt, readPushAlarm, validatePushSubscription, writePushAlarm } from '../lib/resin-push.mjs';
import { checkRequest, configuration, connectedSession, cookieHeader, cookieToken, digest, equalTokens, json, requestBody, STORE, unseal } from '../lib/profile-security.mjs';

// Factory permits isolated security tests without real credentials or provider calls.
export function createProfileHandler({ storeFactory = () => getStore({ name: STORE, consistency: 'strong' }), pushStoreFactory = () => getStore({ name: PUSH_STORE, consistency: 'strong' }), provider = createHoyolabProvider(), artworkProvider = createEnkaArtworkProvider(), env = process.env, now = Date.now } = {}) {
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
        if (session) {
          try { const pushes = pushStoreFactory(); await Promise.all(session.roles.map((role) => pushes.delete(pushAlarmKey(config, sessionKey, role.uid)))); } catch { /* Revoked sessions cannot send; expiry cleanup also removes alarm records. */ }
        }
        return json(status(null), 200, { 'Set-Cookie': cookieHeader(null) });
      }
      const payload = await requestBody(request);
      const allowed = payload.action === 'connect' ? ['action', 'accountId', 'token', 'version', 'consent'] : payload.action === 'push-save' ? ['action', 'uid', 'target', 'subscription', 'publicKey', 'requestId'] : ['profile', 'artwork', 'notes', 'push-status', 'push-prepare', 'push-remove'].includes(payload.action) ? ['action', 'uid'] : ['action', 'uid', 'characterId'];
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
      if (!['profile', 'character', 'artwork', 'notes', 'push-status', 'push-prepare', 'push-save', 'push-remove'].includes(payload.action)) throw new ConnectionError('invalid_request', 400);
      const role = session.roles.find((entry) => entry.uid === payload.uid);
      if (!role) throw new ConnectionError('forbidden', 403);
      async function ensureActive() {
        const entry = await store.getMetadata(sessionKey);
        if (!entry || session.expiresAt <= now()) throw new ConnectionError('reconnect', 401);
        if (request.signal.aborted) throw new ConnectionError('invalid_request', 408);
      }
      if (payload.action.startsWith('push-')) {
        if ((context.deploy?.context ?? env.CONTEXT) !== 'production' || context.deploy?.published === false) throw new ConnectionError('push_unavailable', 503);
        const pushes = pushStoreFactory(), key = pushAlarmKey(config, sessionKey, role.uid);
        if (payload.action === 'push-prepare') {
          const keys = await getPushKeys(pushes, config, true);
          await ensureActive(); return json({ publicKey: keys.publicKey });
        }
        const existing = await readPushAlarm(pushes, key, config);
        const current = existing?.alarm?.expiresAt > now() ? existing.alarm : null;
        if (payload.action === 'push-status') { await ensureActive(); return json({ alarm: pushDisplay(current) }); }
        if (payload.action === 'push-remove') {
          // Even an empty slot gets a cancellation tombstone. An older slow
          // save that read the empty slot cannot resurrect it after this write.
          const cancelled = { ...(existing?.alarm ?? { sessionKey, uid: role.uid, expiresAt: session.expiresAt }), state: 'cancelled', updatedAt: now() };
          const saved = await writePushAlarm(pushes, key, cancelled, config, existing?.etag);
          if (!saved.modified) throw new ConnectionError('push_conflict', 409);
          await ensureActive(); return json({ alarm: null });
        }
        const subscription = validatePushSubscription(payload.subscription);
        if (!Number.isInteger(payload.target) || payload.target < 1 || payload.target > 1000 || typeof payload.requestId !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(payload.requestId)) throw new ConnectionError('invalid_push', 400);
        const keys = await getPushKeys(pushes, config);
        if (payload.publicKey !== keys.publicKey) throw new ConnectionError('push_conflict', 409);
        if (current?.id === payload.requestId && current.target === payload.target && current.subscription?.endpoint === subscription.endpoint) {
          if (current.state === 'cancelled') throw new ConnectionError('push_conflict', 409);
          await ensureActive(); return json({ alarm: pushDisplay(current) });
        }
        if (current && current.state !== 'cancelled' && now() - current.updatedAt < 10_000) throw new ConnectionError('rate_limited', 429);
        const notes = await provider.notes(session.credentials, role);
        const dueAt = pushDueAt(notes, payload.target, now());
        if (dueAt >= session.expiresAt) throw new ConnectionError('push_expiry', 409);
        const alarm = { sessionKey, uid: role.uid, id: payload.requestId, tag: `resin-${digest(key + payload.requestId).slice(0, 24)}`, target: payload.target, subscription, publicKey: keys.publicKey, state: 'armed', dueAt, expiresAt: session.expiresAt, updatedAt: now(), attempts: 0 };
        await ensureActive();
        const saved = await writePushAlarm(pushes, key, alarm, config, existing?.etag);
        if (!saved.modified) throw new ConnectionError('push_conflict', 409);
        await ensureActive(); return json({ alarm: pushDisplay(alarm) });
      }
      if (payload.action === 'notes') {
        const notes = await cached(`${sessionKey}:${role.uid}:notes`, () => provider.notes(session.credentials, role), session.expiresAt);
        await ensureActive(); return json({ notes });
      }
      if (payload.action === 'artwork') {
        const artwork = await cached(`${sessionKey}:${role.uid}:artwork`, () => artworkProvider.get(role.uid), session.expiresAt);
        await ensureActive(); return json({ artwork });
      }
      const profile = await cached(`${sessionKey}:${role.uid}:profile`, () => provider.profile(session.credentials, role), session.expiresAt);
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
