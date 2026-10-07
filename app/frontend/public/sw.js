/* 스스로 서비스 워커: 한 번 열어 본 뒤에는 인터넷이 없어도 화면이 열리게 한다.
 * - /api 는 절대 캐시하지 않는다 (할 일 · 승인 · 이용권은 항상 서버에서)
 * - 첫 화면(HTML)은 네트워크 우선 → 새 버전이 바로 반영되고, 오프라인이면 저장본
 * - 빌드 파일(/assets, 해시 이름) · 아이콘은 캐시 우선
 */
const CACHE = 'sseuro-v1';
const CORE = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put('/', res.clone());
    return res;
  } catch {
    return (await cache.match('/')) ?? Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') e.respondWith(networkFirst(req));
  else if (/^\/(assets|icons)\//.test(url.pathname)) e.respondWith(cacheFirst(req));
});
