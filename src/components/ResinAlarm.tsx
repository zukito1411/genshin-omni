import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { localResinAlarms } from '../utils/localResinAlarms';
import { backgroundNotificationsSupported, deviceNotificationsSupported, enableResinNotifications, subscribeResinPush } from '../utils/resinNotifications';
import { MyProfileError, myProfileRequest } from '../api/myProfile';
import { isPushResinAlarm, type PushResinAlarm } from '../types/resinAlarm';
import type { PrivateProfile } from '../types/myProfile';

export function ResinAlarm({ profile, csrf, expiresAt, onBusyChange }: { profile: PrivateProfile; csrf: string; expiresAt?: number; onBusyChange: (busy: boolean) => void }) {
  const { alarms } = useSyncExternalStore(localResinAlarms.subscribe, localResinAlarms.getSnapshot);
  const alarm = alarms.find((entry) => entry.uid === profile.role.uid);
  const [target, setTarget] = useState(String(alarm?.target ?? Math.min(profile.notes?.maxResin ?? 200, Math.max(40, (profile.notes?.resin ?? 0) + 20))));
  const [device, setDevice] = useState(alarm?.deviceNotification ?? false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [guidance, setGuidance] = useState('');
  const [restoring, setRestoring] = useState(true);
  const active = useRef(true), busyChanged = useRef(onBusyChange); busyChanged.current = onBusyChange;
  const operation = useRef<AbortController | null>(null), confirmed = useRef(false);
  useEffect(() => {
    active.current = true; confirmed.current = false; setRestoring(true);
    const controller = new AbortController();
    void myProfileRequest<{ alarm: PushResinAlarm | null }>('POST', { action: 'push-status', uid: profile.role.uid }, csrf, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (isPushResinAlarm(result.alarm)) {
        localResinAlarms.restorePush(profile.role.uid, csrf, result.alarm);
        setTarget(String(result.alarm.target)); setDevice(true); confirmed.current = true;
      } else if (result.alarm === null) {
        confirmed.current = true;
        if (localResinAlarms.getSnapshot().alarms.find((entry) => entry.uid === profile.role.uid)?.delivery === 'push') localResinAlarms.cancel(profile.role.uid);
      }
    }).catch(() => { if (!controller.signal.aborted) setGuidance('Background alarm settings could not be checked. Refresh My Profile before changing an existing device alarm.'); }).finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    return () => { controller.abort(); operation.current?.abort(); operation.current = null; active.current = false; busyChanged.current(false); };
  }, [profile.role.uid, csrf]);

  async function removePush(signal: AbortSignal) {
    const result = await myProfileRequest<{ alarm: null }>('POST', { action: 'push-remove', uid: profile.role.uid }, csrf, signal);
    if (result.alarm !== null) throw new Error('Alarm change could not be confirmed');
    confirmed.current = true;
  }
  async function cancel() {
    if (busy || restoring) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError(''); busyChanged.current(true);
    try {
      if (alarm?.delivery === 'push' || !confirmed.current) await removePush(controller.signal);
      if (!controller.signal.aborted) { localResinAlarms.cancel(profile.role.uid); setGuidance(''); }
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof MyProfileError ? reason.message : 'Your device alarm could not be cancelled. Refresh My Profile and try again.'); }
    finally { if (operation.current === controller) { operation.current = null; busyChanged.current(false); if (active.current) setBusy(false); } }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || restoring) return;
    const maximum = profile.notes?.maxResin, chosen = Number(target);
    if (!Number.isInteger(chosen) || chosen < 1 || !maximum || chosen > maximum) { setError('Choose a whole-number target within your resin capacity.'); return; }
    if (!profile.notes || !expiresAt || expiresAt <= Date.now()) { setError('Refresh My Profile before setting an alarm.'); return; }
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setError(''); setGuidance(''); busyChanged.current(true);
    try {
      let enabled = false;
      if (device) {
        try { enabled = await enableResinNotifications(); } catch { /* In-site reminders do not require notification permission. */ }
        if (controller.signal.aborted) return;
        if (!enabled) { setDevice(false); setGuidance('Device notifications are off. Your in-site alarm still works. You can allow notifications in your browser or phone settings.'); }
      }
      if (controller.signal.aborted) return;
      if (enabled && backgroundNotificationsSupported()) {
        let savedAttempted = false;
        let requestId = '';
        try {
          const { publicKey } = await myProfileRequest<{ publicKey: string }>('POST', { action: 'push-prepare', uid: profile.role.uid }, csrf, controller.signal);
          if (controller.signal.aborted) return;
          const subscription = await subscribeResinPush(publicKey);
          if (controller.signal.aborted) return;
          requestId = crypto.randomUUID(); savedAttempted = true;
          const result = await myProfileRequest<{ alarm: PushResinAlarm }>('POST', { action: 'push-save', uid: profile.role.uid, target: chosen, subscription, publicKey, requestId }, csrf, controller.signal);
          if (controller.signal.aborted) return;
          if (!isPushResinAlarm(result.alarm)) throw new Error('Alarm save could not be confirmed');
          localResinAlarms.restorePush(profile.role.uid, csrf, result.alarm); confirmed.current = true; return;
        } catch (reason) {
          if (controller.signal.aborted) return;
          if (reason instanceof MyProfileError && ['push_conflict', 'push_expiry', 'rate_limited', 'reconnect', 'forbidden'].includes(reason.code)) throw reason;
          if (savedAttempted) {
            // A timed-out save may have succeeded. Reconcile with the server
            // before falling back, so two independent alarms cannot be armed.
            const result = await myProfileRequest<{ alarm: PushResinAlarm | null }>('POST', { action: 'push-status', uid: profile.role.uid }, csrf, controller.signal);
            if (controller.signal.aborted) return;
            if (isPushResinAlarm(result.alarm)) {
              localResinAlarms.restorePush(profile.role.uid, csrf, result.alarm);
              if (result.alarm.requestId === requestId && result.alarm.target === chosen) return;
              throw new MyProfileError('push_conflict');
            }
            // Null can also mean another tab cancelled the attempted save.
            // Do not replace that cancellation with an unintended local alarm.
            throw new MyProfileError('push_conflict');
          }
          setGuidance(`${reason instanceof MyProfileError ? reason.message : 'Closed-app notifications could not be enabled.'} Using the open-app alarm instead; keep this app open.`);
        }
      } else if (enabled) setGuidance('This browser supports only open-app notifications. Keep the app open for this alarm.');
      if (alarm?.delivery === 'push' || !confirmed.current) await removePush(controller.signal);
      if (controller.signal.aborted) return;
      localResinAlarms.arm({ uid: profile.role.uid, csrf, expiresAt, target: chosen, notes: profile.notes, readAt: profile.updatedAt, deviceNotification: enabled });
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof MyProfileError ? reason.message : 'The alarm change could not be confirmed. Refresh My Profile and try again.'); }
    finally { if (operation.current === controller) { operation.current = null; busyChanged.current(false); if (active.current) setBusy(false); } }
  }
  return <div className="resin-alarm">
    <h3><Bell size={16} />Paimon’s resin alarm</h3>
    <form onSubmit={(event) => void submit(event)}>
      <div className="resin-alarm__form">
        <label>Notify me at<input type="number" inputMode="numeric" min="1" max={profile.notes?.maxResin ?? 200} step="1" required value={target} onChange={(event) => setTarget(event.target.value)} disabled={busy} aria-label="Resin alarm target" /></label>
        <button className="button secondary" type="submit" disabled={busy || restoring}>{restoring ? 'Checking…' : busy ? 'Setting…' : alarm?.state === 'armed' ? 'Update alarm' : 'Set alarm'}</button>
        {alarm?.state === 'armed' && <button className="button secondary" type="button" disabled={busy || restoring} onClick={() => void cancel()}><BellOff size={14} />Cancel alarm</button>}
      </div>
      {deviceNotificationsSupported() && <label className="resin-alarm__device"><input type="checkbox" checked={device} onChange={(event) => setDevice(event.target.checked)} disabled={busy} /><span>Also notify on this device</span></label>}
    </form>
    {alarm?.state === 'armed' && <p role="status">Paimon will alert you at {alarm.target} resin or above. Next check around {new Date(alarm.dueAt).toLocaleString()}.</p>}
    {alarm?.state === 'delivered' && <p role="status">Paimon’s last resin alert was {alarm.delivery === 'push' ? 'sent' : 'shown'}. Set another alarm whenever you like.</p>}
    {alarm?.state === 'unavailable' && <p role="status">Paimon couldn’t check your resin. Refresh My Profile and set the alarm again.</p>}
    <p className="muted">{alarm?.delivery === 'push' ? alarm.state === 'armed' ? `Device alarm saved. You can close the app. Active until ${new Date(expiresAt ?? Date.now()).toLocaleString()}.` : 'This device alarm is no longer active. Set a new alarm to receive another notification.' : 'For closed-app alerts, select “Also notify on this device” and allow notifications. Otherwise keep the app open; closing or reloading cancels local alarms.'}</p>
    <details className="resin-alarm__help"><summary>How alerts work</summary><p className="muted">Paimon checks your actual HoYoLAB resin. Spending resin can delay the alert. Device alarms check about every 5 minutes once due, even with the app closed, and stop when you disconnect or your account connection expires. Delivery depends on internet access, notification permissions, phone settings, and service availability. On iPhone or iPad, enable notifications from the installed Home Screen app. Unsupported browsers still have open-app alarms. No email or extra setup is needed.</p></details>
    {guidance && <p role="status" className="muted">{guidance}</p>}
    {error && <p role="alert" className="error-box">{error}</p>}
  </div>;
}
