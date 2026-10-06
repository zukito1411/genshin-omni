import { createHash, randomBytes } from 'node:crypto';
import { normalizeBuild, normalizeProfile, normalizeRoles } from './hoyolab-data.mjs';

export class ConnectionError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
export async function boundedJson(response, limit = 2_000_000, signal) {
  if (Number(response.headers.get('content-length')) > limit) throw new ConnectionError('unavailable');
  if (!response.body) throw new ConnectionError('unavailable');
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      if (signal?.aborted) throw new ConnectionError('invalid_request', 408);
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new ConnectionError('unavailable');
      chunks.push(value);
    }
    if (signal?.aborted) throw new ConnectionError('invalid_request', 408);
    return JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
  } finally { signal?.removeEventListener('abort', abort); await reader.cancel().catch(() => undefined); }
}
export function parseCredentials(payload) {
  const { accountId, token, version } = payload ?? {};
  if (typeof accountId !== 'string' || !/^\d{1,20}$/.test(accountId) || typeof token !== 'string' || !/^[A-Za-z0-9_.+\/=-]{20,2048}$/.test(token) || !['v1', 'v2'].includes(version)) throw new ConnectionError('invalid_connection', 400);
  return { accountId, token, version };
}
export function createHoyolabProvider(fetcher = fetch) {
  // Community-documented global-server routes. No arbitrary URLs, redirects,
  // login passwords, CAPTCHA bypasses, or game/account mutation endpoints.
  const base = 'https://sg-public-api.hoyolab.com/event/game_record/genshin/api/';
  async function request(credentials, url, method = 'GET', payload, signal) {
    const t = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(6).toString('hex').slice(0, 6);
    // MD5 is required by HoYoLAB's DS protocol; credentials use AES-GCM elsewhere.
    const ds = `${t},${nonce},${createHash('md5').update(`salt=6s25p5ox5y14umn1p61aqyyvbvvl3lrt&t=${t}&r=${nonce}`).digest('hex')}`;
    const suffix = credentials.version === 'v2' ? '_v2' : '';
    const response = await fetcher(url, {
      method, redirect: 'error', signal: signal ?? AbortSignal.timeout(12_000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Cookie: `ltuid${suffix}=${credentials.accountId}; ltoken${suffix}=${credentials.token}`, 'x-rpc-app_version': '1.5.0', 'x-rpc-client_type': '5', 'x-rpc-language': 'en-us', 'x-rpc-lang': 'en-us', DS: ds, Referer: 'https://www.hoyolab.com/', 'User-Agent': 'TeyvatAtlas/1.0' },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (!response.ok) throw new ConnectionError(response.status === 429 ? 'rate_limited' : 'unavailable', response.status === 429 ? 429 : 503);
    const body = await boundedJson(response);
    if (body?.retcode === -100 || body?.retcode === 10001) throw new ConnectionError('reconnect', 401);
    if ([1034, 10035, 5003, 10041, -3101, -3102].includes(body?.retcode)) throw new ConnectionError('verification_required', 409);
    if (body?.retcode === 10102) throw new ConnectionError('private_notes', 409);
    if (body?.retcode !== 0 || !body.data || typeof body.data !== 'object') throw new ConnectionError('unavailable');
    return body.data;
  }
  async function record(credentials, role, endpoint, method = 'GET', extra = {}, signal) {
    const payload = { role_id: role.uid, server: role.region, ...extra };
    const url = new URL(endpoint, base);
    if (method === 'GET') url.search = new URLSearchParams(payload).toString();
    return request(credentials, url.href, method, method === 'POST' ? payload : undefined, signal);
  }
  return {
    async roles(credentials) {
      const roles = normalizeRoles(await request(credentials, 'https://api-os-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie'));
      if (!roles.length) throw new ConnectionError('no_accounts', 400);
      return roles;
    },
    async profile(credentials, role) {
      const signal = AbortSignal.timeout(15_000);
      const results = await Promise.allSettled([
        record(credentials, role, 'index', 'GET', { avatar_list_type: 0 }, signal),
        record(credentials, role, 'dailyNote', 'GET', {}, signal),
        record(credentials, role, 'character/list', 'POST', {}, signal),
      ]);
      const auth = results.find((result) => result.status === 'rejected' && result.reason?.code === 'reconnect');
      if (auth) throw auth.reason;
      const value = (index) => results[index].status === 'fulfilled' ? results[index].value : null;
      const unavailable = results.flatMap((result, index) => result.status === 'rejected' ? [['progress', 'notes', 'characters'][index]] : []);
      if (unavailable.length === 3) throw new ConnectionError('unavailable');
      return normalizeProfile(role, value(0), value(1), value(2), Date.now(), unavailable);
    },
    async character(credentials, role, characterId) {
      const data = await record(credentials, role, 'character/detail', 'POST', { character_ids: [Number(characterId)] });
      const build = normalizeBuild(data, characterId);
      if (!build) throw new ConnectionError('character_unavailable', 404);
      return build;
    },
  };
}
