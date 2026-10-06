import { MyProfileError } from './myProfile';
import type { ProfileSession } from '../types/myProfile';

// Public encryption key used by the global HoYoLAB login protocol (not a secret).
// https://github.com/seriaati/genshin.py/blob/master/genshin/utility/auth.py
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4PMS2JVMwBsOIrYWRluY
wEiFZL7Aphtm9z5Eu/anzJ09nB00uhW+ScrDWFECPwpQto/GlOJYCUwVM/raQpAj
/xvcjK5tNVzzK94mhk+j9RiQ+aWHaTXmOgurhxSp3YbwlRDvOgcq5yPiTz0+kSeK
ZJcGeJ95bvJ+hJ/UMP0Zx2qB5PElZmiKvfiNqVUk8A8oxLJdBB5eCpqWV6CUqDKQ
KSQP4sM0mZvQ1Sr4UcACVcYgYnCbTZMWhJTWkrNXqI8TMomekgny3y+d6NX/cFa6
6jozFIF4HCX5aW8bp8C8vq2tFvFbleQ/Q3CU56EWWKMrOcpmFtRmC18s9biZBVR/
8QIDAQAB
-----END PUBLIC KEY-----`;
export interface EncryptedLogin { account: string; password: string; }
export interface LoginChallenge { version: 3 | 4; sessionId: string; gt: string; challenge?: string; newCaptcha?: boolean; offline?: boolean; riskType?: string; }
export interface PendingLogin { challenge: LoginChallenge; ticket: string; expiresAt: number; }
export async function encryptLogin(account: string, password: string): Promise<EncryptedLogin> {
  if (!window.isSecureContext || !window.crypto?.getRandomValues) throw new MyProfileError('login_browser');
  if (!account.trim() || !password || [account.trim(), password].some((value) => new TextEncoder().encode(value).length > 245 || /[\u0000-\u001f\u007f]/.test(value))) throw new MyProfileError('invalid_login');
  // Load only when signing in. The app's initial bundle has no RSA dependency.
  const { JSEncrypt } = await import('jsencrypt');
  const rsa = new JSEncrypt(); rsa.setPublicKey(PUBLIC_KEY);
  const encryptedAccount = rsa.encrypt(account.trim());
  const encryptedPassword = rsa.encrypt(password);
  if (!encryptedAccount || !encryptedPassword) throw new MyProfileError('login_browser');
  return { account: encryptedAccount, password: encryptedPassword };
}
export async function hoyolabLoginRequest(payload: object | undefined, signal: AbortSignal, method: 'POST' | 'DELETE' = 'POST'): Promise<ProfileSession | PendingLogin> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, 25_000);
  try {
    const response = await fetch('/api/hoyolab-login', { method, credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Teyvat-Client': 'profile' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new MyProfileError('not_configured');
    const body = await response.json();
    if (!response.ok) throw new MyProfileError(body.code ?? 'login_unavailable');
    return body;
  } catch (error) {
    if (signal.aborted || error instanceof MyProfileError) throw error;
    throw new MyProfileError('login_unavailable');
  } finally { window.clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
