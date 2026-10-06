import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, ExternalLink, LogIn } from 'lucide-react';
import { encryptLogin, hoyolabLoginRequest, type EncryptedLogin, type PendingLogin } from '../api/hoyolabLogin';
import type { ProfileSession } from '../types/myProfile';

export function HoYoLabLoginForm({ onConnected, disabled = false, onBusyChange }: { onConnected: (session: ProfileSession) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingLogin | null>(null);
  const operation = useRef<AbortController | null>(null);
  const encrypted = useRef<EncryptedLogin | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const messageId = useRef('');
  const verifying = useRef(false);
  const blocked = busy || disabled;
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const onConnectedRef = useRef(onConnected); onConnectedRef.current = onConnected;
  function clear() { operation.current?.abort(); encrypted.current = null; verifying.current = false; setPassword(''); setVisible(false); setPending(null); setBusy(false); }
  function cancel() { clear(); void hoyolabLoginRequest(undefined, new AbortController().signal, 'DELETE').catch(() => undefined); }
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') clear(); };
    window.addEventListener('pagehide', clear); document.addEventListener('visibilitychange', hidden);
    return () => { operation.current?.abort(); encrypted.current = null; window.removeEventListener('pagehide', clear); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (!pending) return;
    messageId.current = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => String.fromCharCode(byte)).join('');
    messageId.current = btoa(messageId.current).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    verifying.current = false;
    const previous = document.activeElement;
    const modal = dialog.current; modal?.showModal();
    const frameTimeout = window.setTimeout(() => { clear(); setError('The security check could not load. Please try again, or use UID Search.'); }, 20_000);
    const expire = window.setTimeout(() => { clear(); setError('The sign-in check expired. Please sign in again.'); }, Math.max(0, pending.expiresAt - Date.now()));
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      if (event.data?.type === 'captcha-ready') {
        window.clearTimeout(frameTimeout);
        // Sandboxed documents have an opaque origin: '*' is necessary here.
        // Only public challenge parameters are sent, never login credentials.
        frame.current?.contentWindow?.postMessage({ type: 'captcha-init', id: messageId.current, challenge: pending.challenge }, '*');
        return;
      }
      if (event.data?.id !== messageId.current) return;
      if (event.data.type === 'captcha-error') { clear(); setError('The security check could not load. Please try again, or use UID Search.'); return; }
      if (event.data.type !== 'captcha-success' || verifying.current || !encrypted.current || !operation.current) return;
      verifying.current = true;
      const controller = operation.current;
      void hoyolabLoginRequest({ action: 'verify', ...encrypted.current, consent: true, ticket: pending.ticket, proof: event.data.proof }, controller.signal).then((result) => {
        if (controller.signal.aborted) return;
        if ('challenge' in result) { setPending(result); return; }
        encrypted.current = null; setPending(null); setBusy(false); onConnectedRef.current(result);
      }).catch((reason) => { if (!controller.signal.aborted) { clear(); setError(reason instanceof Error ? reason.message : 'Sign-in failed. Please try again.'); } });
    };
    window.addEventListener('message', receive);
    return () => { window.clearTimeout(expire); window.clearTimeout(frameTimeout); window.removeEventListener('message', receive); modal?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [pending]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (blocked || !consent) return;
    const controller = new AbortController(); operation.current?.abort(); operation.current = controller;
    setBusy(true); setError(''); setVisible(false);
    try {
      const value = await encryptLogin(account, password);
      setPassword('');
      if (controller.signal.aborted) return;
      encrypted.current = value;
      const result = await hoyolabLoginRequest({ action: 'login', ...value, consent: true }, controller.signal);
      if (controller.signal.aborted) return;
      if ('challenge' in result) setPending(result);
      else { encrypted.current = null; setBusy(false); onConnectedRef.current(result); }
    } catch (reason) {
      if (!controller.signal.aborted) { clear(); setError(reason instanceof Error ? reason.message : 'Sign-in failed. Please try again.'); }
    }
  }
  return <>
    <h3>Sign in to your HoYoLAB account</h3>
    <p>Use your HoYoverse email or username and password. No session tokens or developer tools needed.</p>
    <form className="connected-profile-form" autoComplete="off" onSubmit={(event) => void submit(event)}>
      <label>Email or username<input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={245} required value={account} onChange={(event) => setAccount(event.target.value)} disabled={blocked} /></label>
      <label>HoYoverse password<span className="hoyolab-password"><input type={visible ? 'text' : 'password'} autoComplete="off" maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={blocked} /><button type="button" className="button secondary" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible((value) => !value)} disabled={blocked}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
      <label className="connected-profile-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required disabled={blocked} /><span>This is my account. I agree to connect it so this site can read my game profile.</span></label>
      {error && <p role="alert" className="error-box">{error}</p>}
      <div className="hoyolab-login-actions"><button type="submit" className="button primary" disabled={blocked || !consent}><LogIn size={16} />{busy ? 'Signing in…' : 'Sign in'}</button>{busy && <button type="button" className="button secondary" onClick={cancel}>Cancel sign-in</button>}</div>
    </form>
    <p className="muted">Your email and password are encrypted for HoYoLAB before leaving your browser. This fan-made connection is not official HoYoverse sign-in. A security check may be required.</p>
    <p className="muted">Google, Apple, and other social sign-ins are not supported here. Manage your account only on <a href="https://account.hoyolab.com/" target="_blank" rel="noreferrer">official HoYoLAB <ExternalLink size={12} /></a>.</p>
    {pending && <dialog ref={dialog} className="hoyolab-captcha-dialog" aria-labelledby="hoyolab-captcha-title" onCancel={(event) => { event.preventDefault(); cancel(); }}><div className="hoyolab-captcha-heading"><h3 id="hoyolab-captcha-title">HoYoLAB security check</h3><button type="button" className="button secondary" onClick={cancel}>Cancel</button></div><p>Complete the check to finish signing in. It expires after five minutes.</p><iframe key={pending.ticket} ref={frame} src="/api/hoyolab-captcha" title="HoYoLAB login security challenge" sandbox="allow-scripts allow-popups" referrerPolicy="no-referrer" /><p className="muted">If the check does not appear, cancel and try again.</p></dialog>}
  </>;
}
