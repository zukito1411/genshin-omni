import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConnectionError, boundedJson } from './hoyolab-provider.mjs';

export const COOKIE = '__Host-teyvat-profile';
export const SESSION_MS = 24 * 60 * 60 * 1000;
export const STORE = 'teyvat-private-profiles-v1';
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export function configuration(env) {
  if (env.HOYOLAB_ENABLED !== 'true' || !/^[a-f\d]{64}$/i.test(env.HOYOLAB_ENCRYPTION_KEY ?? '')) return null;
  try {
    const url = new URL(env.HOYOLAB_APP_ORIGIN);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (env.CONTEXT && env.CONTEXT !== 'production') return null;
    return { origin: url.origin, key: Buffer.from(env.HOYOLAB_ENCRYPTION_KEY, 'hex') };
  } catch { return null; }
}
export function seal(value, key, associatedData) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
}
export function unseal(value, key, associatedData) {
  if (value?.version !== 1 || typeof value.iv !== 'string' || typeof value.tag !== 'string' || typeof value.data !== 'string' || value.data.length > 32_000) throw new ConnectionError('reconnect', 401);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  decipher.setAAD(Buffer.from(associatedData));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
}
export function cookieToken(request) {
  const cookies = request.headers.get('cookie') ?? '';
  const matches = cookies.split(';').map((item) => item.trim()).filter((item) => item.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export const cookieHeader = (token) => `${COOKIE}=${token ?? ''}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token ? SESSION_MS / 1000 : 0}`;
export function equalTokens(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(a) || !/^[A-Za-z0-9_-]{43}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function checkRequest(request, origin) {
  if (new URL(request.url).origin !== origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new ConnectionError('forbidden', 403);
  const supplied = request.headers.get('origin');
  if ((supplied && supplied !== origin) || (request.method !== 'GET' && supplied !== origin)) throw new ConnectionError('forbidden', 403);
  if (request.method !== 'GET' && request.headers.get('x-teyvat-client') !== 'profile') throw new ConnectionError('forbidden', 403);
}
export async function requestBody(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ConnectionError('invalid_request', 415);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const data = await boundedJson(request, 6000, AbortSignal.any([controller.signal, request.signal]));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch (error) { throw error instanceof ConnectionError && error.status === 408 ? error : new ConnectionError('invalid_request', 400); }
  finally { clearTimeout(timer); }
}
export function json(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', 'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', Pragma: 'no-cache', Vary: 'Cookie, Origin', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', ...extra } });
}
