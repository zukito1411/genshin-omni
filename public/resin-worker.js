// Notifications only: no fetch handler, offline cache or timer. No UID/login
// credentials are received. Safe upgrades also replace the former local worker.
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (!payload || typeof payload.body !== 'string' || payload.body.length > 300 || typeof payload.tag !== 'string' || !/^resin-[a-f\d]{24}$/.test(payload.tag)) return;
  event.waitUntil((async () => {
    await self.registration.showNotification('Paimon · Resin ready!', {
      body: payload.body, tag: payload.tag, icon: '/paimon/face.png', badge: '/assets/app-icon-192-v1.png', data: { path: '/me' },
    });
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: 'resin-delivered', tag: payload.tag, body: payload.body });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/me', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })());
});
