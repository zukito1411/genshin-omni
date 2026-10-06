import { createECDH, createPublicKey } from 'node:crypto';
import webpush from 'web-push';
import { ConnectionError } from './hoyolab-provider.mjs';
import { digest, seal, unseal } from './profile-security.mjs';

export const PUSH_STORE = 'teyvat-resin-push-v2';
export const pushPrefix = (config) => `${digest(config.origin)}/alarms/`;
export const pushAlarmKey = (config, sessionKey, uid) => `${pushPrefix(config)}${sessionKey.split('/')[1]}/${digest(uid)}`;

function validKeys(value) {
  if (!/^[\w-]{87}$/.test(value?.publicKey ?? '') || !/^[\w-]{43}$/.test(value?.privateKey ?? '')) return false;
  try { const pair = createECDH('prime256v1'); pair.setPrivateKey(Buffer.from(value.privateKey, 'base64url')); return pair.getPublicKey().toString('base64url') === value.publicKey; } catch { return false; }
}
export async function getPushKeys(store, config, create = false, generate = webpush.generateVAPIDKeys) {
  const key = `${digest(config.origin)}/keys/v1`;
  // Strong reads + conditional writes ensure racing cold starts return the
  // SAME durable key pair. Existing account encryption protects it at rest.
  for (let attempt = 0; attempt < 3; attempt++) {
    const entry = await store.getWithMetadata(key, { type: 'json' });
    if (entry) {
      try { const keys = unseal(entry.data, config.key, key); if (validKeys(keys)) return { ...keys, subject: config.origin }; } catch { /* Rotated account encryption key: re-key only on explicit setup. */ }
    }
    if (!create) throw new ConnectionError('push_unavailable', 503);
    const keys = generate();
    if (!validKeys(keys)) throw new ConnectionError('push_unavailable', 503);
    const saved = await store.setJSON(key, seal(keys, config.key, key), { ...(entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true }), metadata: { kind: 'keys' } });
    if (saved.modified) return { ...keys, subject: config.origin };
  }
  throw new ConnectionError('push_unavailable', 503);
}

export function validatePushSubscription(value) {
  try {
    const url = new URL(value?.endpoint);
    const allowed = url.hostname === 'fcm.googleapis.com' && /^\/fcm\/send\/[\w:+=-]+$/.test(url.pathname)
      || url.hostname === 'updates.push.services.mozilla.com' && /^\/wpush\/v[12]\/[\w=-]+$/.test(url.pathname)
      || url.hostname === 'web.push.apple.com' && /^\/[\w-][\w/-]*$/.test(url.pathname)
      || /^[a-z\d-]+\.notify\.windows\.com$/.test(url.hostname) && url.pathname === '/w/' && /^[\w+=&%-]*$/.test(url.search.slice(1));
    if (!allowed || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.href.length > 2048 || (!url.hostname.endsWith('.notify.windows.com') && url.search)) throw new Error();
    const auth = value?.keys?.auth, p256dh = value?.keys?.p256dh;
    if (!/^[\w-]{22}$/.test(auth ?? '') || !/^[\w-]{87}$/.test(p256dh ?? '')) throw new Error();
    const point = Buffer.from(p256dh, 'base64url');
    if (point.length !== 65 || point[0] !== 4) throw new Error();
    createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') }, format: 'jwk' });
    return { endpoint: url.href, keys: { auth, p256dh } };
  } catch { throw new ConnectionError('invalid_push', 400); }
}

export function pushDueAt(notes, target, now) {
  const { resin, maxResin, recoverySeconds } = notes ?? {};
  if (!Number.isInteger(resin) || !Number.isInteger(maxResin) || maxResin < 1 || maxResin > 1000 || resin < 0 || resin > maxResin || !Number.isInteger(target) || target < 1 || target > maxResin) throw new ConnectionError('notes_unavailable', 409);
  if (resin >= target) return now;
  if (!Number.isInteger(recoverySeconds) || recoverySeconds <= 0 || recoverySeconds > (maxResin - resin) * 480) throw new ConnectionError('notes_unavailable', 409);
  return now + Math.max(1, recoverySeconds - (maxResin - target) * 480) * 1000;
}
export function pushDisplay(alarm) {
  return alarm && alarm.state !== 'cancelled' ? { target: alarm.target, state: alarm.state, dueAt: alarm.dueAt, expiresAt: alarm.expiresAt, tag: alarm.tag, requestId: alarm.id } : null;
}
export async function readPushAlarm(store, key, config) {
  const entry = await store.getWithMetadata(key, { type: 'json' });
  if (!entry) return null;
  try { return { alarm: unseal(entry.data, config.key, key), etag: entry.etag }; } catch { return { alarm: null, etag: entry.etag }; }
}
export function writePushAlarm(store, key, alarm, config, etag) {
  return store.setJSON(key, seal(alarm, config.key, key), { ...(etag ? { onlyIfMatch: etag } : { onlyIfNew: true }), metadata: { kind: 'alarm', expiresAt: alarm.expiresAt, nextCheck: alarm.state === 'armed' ? alarm.dueAt : null } });
}
