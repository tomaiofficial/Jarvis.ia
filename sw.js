// Service Worker JARVIS v5
const CACHE = 'jarvis-v5';
const BASE = self.location.pathname.replace(/\/sw\.js$/, '/');
const ASSETS = ['index.html', 'styles.css', 'app.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(a => new URL(a, BASE).href)))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!url.protocol.startsWith('http')) return;

  // API: network first
  if (url.hostname.includes('generativelanguage.googleapis.com') || url.hostname.includes('api.groq.com') || url.hostname.includes('api.elevenlabs.io') || url.hostname.includes('text.pollinations.ai')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Static: cache first with network fallback
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      if (r.ok && e.request.method === 'GET') {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return r;
    }))
  );
});
