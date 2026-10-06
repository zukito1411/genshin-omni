// Deliberately bypass the public-data cache. Sessions and account data live only
// in memory; the browser receives an opaque HttpOnly cookie, never HoYoLAB tokens.
const messages: Record<string, string> = {
  not_configured: 'Account connection is not available on this site yet. You can still use UID Search.',
  invalid_connection: 'Please check your HoYoLAB account ID, session token, and session version.',
  invalid_request: 'The connection could not be completed. Please try again.',
  consent_required: 'Please confirm that this is your own account and that you agree to connect it.',
  no_accounts: 'No supported Genshin account was found. This connection currently supports global servers.',
  reconnect: 'Your connection has expired. Please connect your HoYoLAB account again.',
  verification_required: 'HoYoLAB needs a security check. Open HoYoLAB, complete the check, then try again.',
  private_notes: 'Enable Real-Time Notes in your HoYoLAB Battle Chronicle to view resin and daily tasks.',
  forbidden: 'This account or character is not available through your current connection.',
  rate_limited: 'Please wait a moment before refreshing again.',
  character_unavailable: 'This character’s equipped details are unavailable. Your other profile information is still here.',
  already_connected: 'Disconnect the current account before connecting another one.',
  unavailable: 'HoYoLAB could not be reached. Please try again later.',
  invalid_login: 'Please enter your HoYoverse email or username and password.',
  login_browser: 'Secure sign-in is not supported by this browser. Please use an updated browser over HTTPS.',
  login_failed: 'Sign-in failed. Check your email or username and password. Use your HoYoverse credentials, not a Google or Apple password.',
  login_locked: 'HoYoLAB temporarily locked sign-in after too many attempts. Please wait and try again later.',
  login_verification: 'HoYoLAB could not complete the security check. Please try again or check your account on the official HoYoLAB website.',
  login_expired: 'The sign-in check expired or was already used. Please sign in again.',
  login_unavailable: 'HoYoLAB sign-in is unavailable right now. Please try again later. UID Search still works.',
  login_cancelled: 'Sign-in was cancelled. Please try again when you are ready.',
};
export class MyProfileError extends Error {
  code: string;
  constructor(code: string) { super(messages[code] ?? messages.unavailable); this.code = code; }
}
export async function myProfileRequest<T>(method: 'GET' | 'POST' | 'DELETE', payload?: object, csrf?: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(abort, 20_000);
  try {
    const response = await fetch('/api/my-profile', {
      method, cache: 'no-store', credentials: 'same-origin', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', ...(method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Teyvat-Client': 'profile', ...(csrf ? { 'X-Teyvat-CSRF': csrf } : {}) }) },
      ...(payload ? { body: JSON.stringify(payload) } : {}), signal: controller.signal,
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new MyProfileError('not_configured');
    const result = await response.json() as { code?: string };
    if (!response.ok) throw new MyProfileError(result.code ?? 'unavailable');
    return result as T;
  } catch (error) {
    if (signal?.aborted || error instanceof MyProfileError) throw error;
    throw new MyProfileError('unavailable');
  } finally { window.clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
