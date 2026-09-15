// Service Worker para Portal SAAV Expenses (PWA Offline)
const CACHE_NAME = 'saav-expenses-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest'
];

// Instalação: Cache dos assets básicos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Interceptação de requisições: Stale-While-Revalidate para estáticos, Network-First para APIs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não faz cache de requisições do Supabase, analytics ou extensões do navegador
  if (
    url.origin.includes('supabase.co') || 
    url.origin.includes('vercel-insights.com') ||
    url.protocol.startsWith('chrome-extension') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Navegação HTML: Network-First com fallback para index.html no cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html') || await caches.match('/');
        if (cached) return cached;
        return new Response('<html><body><h1>SAAV Expenses Offline</h1><p>Conexão indisponível.</p></body></html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      })
    );
    return;
  }

  // Assets Estáticos: Stale-While-Revalidate robusto sem retorno undefined
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse && 
            networkResponse.status === 200 && 
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (cachedResponse) return cachedResponse;
          return new Response('', { status: 503, statusText: 'Offline' });
        });

      return cachedResponse || fetchPromise;
    })
  );
});
