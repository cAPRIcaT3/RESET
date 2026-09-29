// Upgrade the original RESET service worker at its existing registration URL.
// The new app registers sw.js; both now use the same online-first policy.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method === 'GET') event.respondWith(fetch(event.request));
});
