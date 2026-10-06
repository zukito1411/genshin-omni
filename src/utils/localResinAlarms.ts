import { MyProfileError, myProfileRequest } from '../api/myProfile';
import { resinDueAt, validResin, type ResinReading } from './resinTiming';
import { showResinNotification } from './resinNotifications';
import { isPushResinAlarm, type PushResinAlarm } from '../types/resinAlarm';

export interface LocalResinAlarm {
  uid: string; target: number; dueAt: number; state: 'armed' | 'delivered' | 'unavailable'; deviceNotification: boolean;
  delivery: 'local' | 'push'; tag?: string;
}
interface StoredAlarm extends LocalResinAlarm { csrf: string; expiresAt: number; failures: number; lastChecked: number; }
interface Notice { message: string; ready: boolean; }
interface Snapshot { alarms: LocalResinAlarm[]; notice: Notice | null; }
interface Options {
  now?: () => number;
  read?: (uid: string, csrf: string, signal: AbortSignal) => Promise<ResinReading | null>;
  readPush?: (uid: string, csrf: string, signal: AbortSignal) => Promise<PushResinAlarm | null>;
  notify?: (body: string, tag: string) => Promise<void>;
  setTimer?: (callback: () => void, delay: number) => number;
  clearTimer?: (timer: number) => void;
}

/** Browser state is memory only. Push-mode checks status, never fires a duplicate local notification. */
export function createLocalResinAlarms({ now = () => Date.now(), read = async (uid, csrf, signal) => (await myProfileRequest<{ notes: ResinReading | null }>('POST', { action: 'notes', uid }, csrf, signal)).notes, readPush = async (uid, csrf, signal) => (await myProfileRequest<{ alarm: PushResinAlarm | null }>('POST', { action: 'push-status', uid }, csrf, signal)).alarm, notify = showResinNotification, setTimer = (callback, delay) => window.setTimeout(callback, delay), clearTimer = (timer) => window.clearTimeout(timer) }: Options = {}) {
  const alarms = new Map<string, StoredAlarm>(), listeners = new Set<() => void>(), pending = new Map<string, AbortController>();
  let snapshot: Snapshot = { alarms: [], notice: null }, timer: number | null = null, running = false, checking = false;
  function publish(notice: Notice | null = snapshot.notice) {
    snapshot = { alarms: [...alarms.values()].map(({ uid, target, dueAt, state, deviceNotification, delivery, tag }) => ({ uid, target, dueAt, state, deviceNotification, delivery, tag })), notice };
    listeners.forEach((listener) => listener());
  }
  function schedule() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (!running || checking) return;
    const active = [...alarms.values()].filter((alarm) => alarm.state === 'armed');
    if (!active.length) return;
    const next = Math.min(...active.map((alarm) => Math.min(alarm.expiresAt, alarm.dueAt)));
    timer = setTimer(() => { timer = null; void checkDue(); }, Math.max(1000, Math.min(2_147_483_647, next - now())));
  }
  function remove(uid: string) {
    pending.get(uid)?.abort(); pending.delete(uid); alarms.delete(uid); publish(); schedule();
  }
  function clear() {
    pending.forEach((controller) => controller.abort()); pending.clear(); alarms.clear(); publish(null); schedule();
  }
  async function check(alarm: StoredAlarm) {
    const controller = new AbortController(); pending.set(alarm.uid, controller);
    const current = () => !controller.signal.aborted && alarms.get(alarm.uid) === alarm && alarm.expiresAt > now();
    try {
      if (alarm.delivery === 'push') {
        const remote = await readPush(alarm.uid, alarm.csrf, controller.signal);
        if (!current()) return;
        if (!remote) { remove(alarm.uid); return; }
        if (!isPushResinAlarm(remote)) throw new MyProfileError('push_unavailable');
        Object.assign(alarm, remote, { dueAt: Math.max(now() + 60_000, remote.dueAt), lastChecked: now(), failures: 0 });
        publish(); return;
      }
      const notes = await read(alarm.uid, alarm.csrf, controller.signal);
      if (!current()) return;
      if (!validResin(notes) || alarm.target > notes.maxResin) {
        alarm.state = 'unavailable'; publish({ message: 'Paimon couldn’t read your resin. Refresh My Profile and set the alarm again.', ready: false }); return;
      }
      alarm.lastChecked = now(); alarm.failures = 0;
      if (notes.resin < alarm.target) {
        alarm.dueAt = Math.max(now() + 60_000, resinDueAt(notes, alarm.target, now()) ?? now() + 60_000); publish(); return;
      }
      // Only a fresh authenticated reading can fire an alarm, never a timer's
      // estimate. Mark delivered before notifying to prevent duplicate checks.
      alarm.state = 'delivered';
      const message = `Hey Traveler! Your Original Resin is now ${notes.resin} (target ${alarm.target}). Let’s go on an adventure!`;
      publish({ message, ready: true });
      if (alarm.deviceNotification && current()) {
        try { await notify(message, 'teyvat-local-resin'); }
        catch { /* The in-site Paimon alert remains available without OS delivery. */ }
      }
    } catch (error) {
      if (!current()) return;
      if (error instanceof MyProfileError && error.code === 'reconnect') {
        clear(); publish({ message: 'Your HoYoLAB connection ended. Resin alarms stopped; reconnect in My Profile to set another one.', ready: false });
      } else if (error instanceof MyProfileError && ['forbidden', 'private_notes'].includes(error.code)) {
        alarm.state = 'unavailable'; publish({ message: 'Paimon can’t check this account’s resin. Refresh My Profile and check Real-Time Notes before setting another alarm.', ready: false });
      } else {
        alarm.lastChecked = now(); alarm.failures++;
        alarm.dueAt = now() + Math.min(300_000, 60_000 * 2 ** Math.min(alarm.failures - 1, 3));
        if (alarm.failures >= 5) {
          alarm.state = 'unavailable'; publish({ message: 'Paimon couldn’t check your resin after several attempts. Refresh My Profile and set the alarm again.', ready: false });
        } else publish();
      }
    } finally { if (pending.get(alarm.uid) === controller) pending.delete(alarm.uid); }
  }
  async function checkDue(resumed = false) {
    if (checking) return;
    checking = true;
    try {
      for (const alarm of alarms.values()) if (alarm.expiresAt <= now()) remove(alarm.uid);
      const due = [...alarms.values()].filter((alarm) => alarm.state === 'armed' && (alarm.dueAt <= now() || resumed && now() - alarm.lastChecked >= 60_000));
      // At most two private reads at once, and no periodic requests when idle.
      for (let index = 0; index < due.length; index += 2) await Promise.all(due.slice(index, index + 2).filter((alarm) => alarms.get(alarm.uid) === alarm).map(check));
    } finally { checking = false; schedule(); }
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    arm(input: { uid: string; csrf: string; expiresAt: number; target: number; notes: ResinReading; readAt: number; deviceNotification: boolean }) {
      if (!/^\d{9,10}$/.test(input.uid) || !/^[\w-]{43}$/.test(input.csrf) || !Number.isFinite(input.expiresAt) || input.expiresAt <= now() || input.expiresAt > now() + 86_460_000) throw new Error('Refresh My Profile before setting an alarm.');
      if (!validResin(input.notes) || !Number.isInteger(input.target) || input.target < 1 || input.target > input.notes.maxResin) throw new Error('Choose a whole-number target within your resin capacity.');
      if (!alarms.has(input.uid) && alarms.size >= 20) throw new Error('Cancel an existing alarm before adding another.');
      pending.get(input.uid)?.abort(); pending.delete(input.uid);
      const readAt = Number.isFinite(input.readAt) && input.readAt <= now() + 60_000 ? input.readAt : now();
      const dueAt = now() - readAt > 120_000 ? now() : Math.max(now(), resinDueAt(input.notes, input.target, readAt) ?? now() + 60_000);
      alarms.set(input.uid, { uid: input.uid, csrf: input.csrf, expiresAt: input.expiresAt, target: input.target, deviceNotification: input.deviceNotification, delivery: 'local', dueAt, state: 'armed', failures: 0, lastChecked: now() });
      publish(null); schedule();
    },
    cancel: remove, clear, checkDue,
    restorePush(uid: string, csrf: string, alarm: PushResinAlarm) {
      if (!isPushResinAlarm(alarm) || alarm.expiresAt <= now() || !/^\d{9,10}$/.test(uid) || !/^[\w-]{43}$/.test(csrf)) return;
      if (!alarms.has(uid) && alarms.size >= 20) return;
      pending.get(uid)?.abort(); pending.delete(uid);
      alarms.set(uid, { ...alarm, uid, csrf, delivery: 'push', deviceNotification: true, dueAt: Math.max(now() + 60_000, alarm.dueAt), failures: 0, lastChecked: now() });
      publish(); schedule();
    },
    receivedPush(tag: string, message: string) {
      const alarm = [...alarms.values()].find((entry) => entry.delivery === 'push' && entry.tag === tag);
      if (!alarm || alarm.state !== 'armed' || alarm.expiresAt <= now() || typeof message !== 'string' || message.length > 300) return;
      pending.get(alarm.uid)?.abort(); pending.delete(alarm.uid);
      alarm.state = 'delivered'; publish({ message, ready: true }); schedule();
    },
    dismiss() { publish(null); },
    start() { running = true; schedule(); return () => { running = false; if (timer !== null) clearTimer(timer); timer = null; pending.forEach((controller) => controller.abort()); pending.clear(); }; },
  };
}
export const localResinAlarms = createLocalResinAlarms();
