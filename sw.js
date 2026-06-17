/* sw.js – Live English push receiver */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Live English', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Live English';
  const options = {
    body: data.body || 'لديك تنبيه جديد',
    icon: data.icon || 'https://i.ibb.co/2QNwJCd/image.png',
    badge: data.badge || 'https://i.ibb.co/2QNwJCd/image.png',
    tag: data.tag || 'live-english-notification',
    data: {
      url: data.url || '/admin.html'
    },
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification?.data?.url || '/admin.html', self.location.origin).href;

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (client.url === targetUrl && 'focus' in client) {
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  })());
});
