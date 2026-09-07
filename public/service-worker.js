const SHELL_CACHE = 'reset-shell-v5-daily';
const MEDIA_CACHE = 'reset-media-v1';
const scopeUrl = path => new URL(path, self.registration.scope).toString();
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './dailyPack.js',
  './audioEngine.js',
  './themeEngine.js',
  './dockDrivers.js',
  './dockBackdrop.js',
  './manifest.webmanifest',
  './icons/reset-icon.svg'
].map(scopeUrl);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => ![SHELL_CACHE, MEDIA_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.includes('/api/')) return;

  if (url.pathname.endsWith('/generated/latest.json')) {
    event.respondWith(networkFirst(request, MEDIA_CACHE));
    return;
  }

  if (url.pathname.includes('/generated/') && /\.(?:mp3|wav|ogg)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, SHELL_CACHE, true));
});

async function networkFirst(request, cacheName, navigationFallback = false) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      void caches.open(cacheName).then(cache => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (navigationFallback && request.mode === 'navigate') return caches.match(scopeUrl('./index.html'));
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    void caches.open(cacheName).then(cache => cache.put(request, copy));
  }
  return response;
}
