// Service Worker pour JARVIS PWA
const CACHE_NAME = 'jarvis-v2';

// Calculer la base URL automatiquement
const BASE_URL = self.location.pathname.replace(/\/sw\.js$/, '/');

const STATIC_ASSETS = [
  '',
  'index.html',
  'manifest.json',
  'styles.css',
  'app.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// Installation - mise en cache des assets statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS.map(path => new URL(path, BASE_URL).href));
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.warn('SW install cache error:', err);
        return self.skipWaiting();
      })
  );
});

// Activation - nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Stratégie de cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-HTTP
  if (!url.protocol.startsWith('http')) return;

  // API calls - Network First
  if (url.hostname.includes('generativelanguage.googleapis.com') ||
      url.hostname.includes('api.groq.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets statiques - Cache First
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Fallback pour les pages HTML
    const accept = request.headers.get('accept') || '';
    if (accept.includes('text/html')) {
      const baseIndex = new URL('index.html', BASE_URL).href;
      return caches.match(baseIndex) || new Response('Offline', { status: 503 });
    }
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

// Gestion des messages du client
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
