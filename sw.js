// Service Worker JARVIS v7 — Robust for mobile
var CACHE = 'jarvis-v7';
var BASE = self.location.pathname.replace(/\/sw\.js$/, '/');
var ASSETS = ['index.html', 'styles.css', 'app.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c) { return c.addAll(ASSETS.map(function(a) { return new URL(a, BASE).href; })); })
      .then(function() { return self.skipWaiting(); })
      .catch(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(ks) {
      return Promise.all(ks.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url;
  try { url = new URL(e.request.url); } catch(err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API calls: network first, no cache for errors
  if (url.hostname.includes('generativelanguage.googleapis.com') ||
      url.hostname.includes('api.groq.com') ||
      url.hostname.includes('api.elevenlabs.io') ||
      url.hostname.includes('text.pollinations.ai') ||
      url.hostname.includes('wttr.in')) {
    e.respondWith(
      fetch(e.request).then(function(r) {
        // Only cache successful responses
        if (r.ok) {
          var clone = r.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return r;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Navigation: network first, fallback to cached index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function(r) {
        if (r.ok) {
          var clone = r.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return r;
      }).catch(function() {
        return caches.match(new URL('index.html', BASE).href);
      })
    );
    return;
  }

  // Static: cache first with network fallback
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(r) {
        if (r.ok && e.request.method === 'GET') {
          var clone = r.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return r;
      });
    })
  );
});
