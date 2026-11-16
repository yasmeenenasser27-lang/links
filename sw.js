const CACHE = 'eslam-links-v1';
const LOCAL = ['./', './index.html', './manifest.json', './eng.png', './icon-192.png', './icon-512.png'];
const FONT_CSS = [
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&family=Rajdhani:wght@500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];
const FA_FONTS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL);
    // Cache external CSS + the font files it references so the first visit is enough
    for (const url of FONT_CSS) {
      try {
        const res = await fetch(url, { mode: 'cors' });
        await cache.put(url, res.clone());
        const css = await res.text();
        const base = new URL(url);
        const urls = [...css.matchAll(/url\(([^)]+)\)/g)]
          .map(m => m[1].replace(/['"]/g, '').trim())
          .map(u => new URL(u, base).href);
        await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(r => cache.put(u, r)).catch(() => {})));
      } catch (_) {}
    }
    await Promise.all(FA_FONTS.map(u => fetch(u, { mode: 'cors' }).then(r => cache.put(u, r)).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first, refresh in background when online
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isAsset = url.origin === location.origin ||
    ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'].includes(url.hostname);
  if (!isAsset) return; // external links (YouTube, etc.) go straight to the network

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: false }) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => undefined);
    return cached || (await network) || new Response('Offline', { status: 503 });
  })());
});
