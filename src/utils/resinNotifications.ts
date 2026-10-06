let registration: ServiceWorkerRegistration | null = null;

export function deviceNotificationsSupported(): boolean {
  return window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator;
}

/** Called only from the player's Set alarm button, never automatically. */
export async function enableResinNotifications(): Promise<boolean> {
  if (!deviceNotificationsSupported() || Notification.permission === 'denied') return false;
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const candidate = await navigator.serviceWorker.register('/resin-worker.js', { scope: '/', updateViaCache: 'none' });
  if (typeof candidate.update === 'function') await candidate.update();
  if (candidate.installing || candidate.waiting || !candidate.active) {
    await new Promise<void>((resolve, reject) => {
      const worker = candidate.installing ?? candidate.waiting;
      if (!worker) return reject(new Error('Notification worker unavailable'));
      const done = () => {
        if (worker.state !== 'activated' && worker.state !== 'redundant') return;
        window.clearTimeout(timer); worker.removeEventListener('statechange', done);
        if (worker.state === 'activated') resolve(); else reject(new Error('Notification worker unavailable'));
      };
      const timer = window.setTimeout(() => { worker.removeEventListener('statechange', done); reject(new Error('Notification worker unavailable')); }, 10_000);
      worker.addEventListener('statechange', done); done();
    });
  }
  registration = candidate;
  return typeof candidate.showNotification === 'function';
}

export function backgroundNotificationsSupported(): boolean {
  return deviceNotificationsSupported() && 'PushManager' in window && Boolean(registration?.pushManager);
}
export async function subscribeResinPush(publicKey: string): Promise<PushSubscriptionJSON> {
  if (!registration?.pushManager || !/^[\w-]{87}$/.test(publicKey)) throw new Error('Push notifications unavailable');
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  const existing = subscription?.options.applicationServerKey;
  if (subscription && (!existing || existing.byteLength !== key.length || !Array.from(new Uint8Array(existing)).every((byte, index) => byte === key[index]))) {
    await subscription.unsubscribe(); subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return subscription.toJSON();
}

export async function showResinNotification(body: string, tag: string): Promise<void> {
  if (!registration || Notification.permission !== 'granted') return;
  const options: NotificationOptions & { renotify: boolean } = {
    body, tag, renotify: true, icon: '/paimon/face.png', badge: '/assets/app-icon-192-v1.png', data: { path: '/me' },
  };
  await registration.showNotification('Paimon · Resin ready!', options);
}
