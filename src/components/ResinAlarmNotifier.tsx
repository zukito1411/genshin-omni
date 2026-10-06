import { useEffect, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { localResinAlarms } from '../utils/localResinAlarms';

export function ResinAlarmNotifier() {
  const { notice } = useSyncExternalStore(localResinAlarms.subscribe, localResinAlarms.getSnapshot);
  useEffect(() => {
    const stop = localResinAlarms.start();
    const resume = () => { if (document.visibilityState === 'visible') void localResinAlarms.checkDue(true); };
    const leave = (event: PageTransitionEvent) => { if (!event.persisted) localResinAlarms.clear(); };
    const pushed = (event: MessageEvent) => {
      const worker = event.source as ServiceWorker | null;
      if (worker?.scriptURL !== new URL('/resin-worker.js', window.location.origin).href || event.data?.type !== 'resin-delivered') return;
      localResinAlarms.receivedPush(event.data.tag, event.data.body);
    };
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel('teyvat-profile-connection'); channel.onmessage = () => localResinAlarms.clear(); } catch { /* Backend ownership and expiry checks still apply. */ }
    document.addEventListener('visibilitychange', resume); window.addEventListener('pageshow', resume); window.addEventListener('pagehide', leave);
    navigator.serviceWorker?.addEventListener?.('message', pushed);
    return () => { stop(); channel?.close(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('pageshow', resume); window.removeEventListener('pagehide', leave); navigator.serviceWorker?.removeEventListener?.('message', pushed); };
  }, []);
  if (!notice) return null;
  return <aside className="resin-notice panel" role="status" aria-live="polite" aria-label="Paimon resin notification">
    <img src="/paimon/face.png" alt="" width="42" height="42" />
    <div><strong>Paimon{notice.ready ? ' · Resin ready!' : ' · Resin alarm'}</strong><p>{notice.message}</p><Link className="text-button" to="/me">Open My Profile</Link></div>
    <button className="resin-notice__dismiss" type="button" aria-label="Dismiss resin notification" onClick={() => localResinAlarms.dismiss()}><X size={18} /></button>
  </aside>;
}
