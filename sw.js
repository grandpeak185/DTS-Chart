/* 图展千帆现 · 移动版 Service Worker
   版本号由 build_chart.py 按当轮数据写入，内容一变浏览器就会拉新的 SW。
   策略：导航请求 network-first（在线拿最新，离线回退缓存）；静态资源 cache-first。 */
const VER = 'yp-m-e6388bac12';
const CORE = [
  './m.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    for (const u of CORE) {
      try { await c.add(new Request(u, { cache: 'reload' })); } catch (err) { /* 单个失败不拦住安装 */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r && r.ok) {
          const c = await caches.open(VER);
          c.put('./m.html', r.clone()).catch(() => {});
          return r;
        }
        // 会走到这里通常是因为访问凭据（sharecode 的 cookie）过期被挡在门外
        const hit = await caches.match('./m.html');
        return hit || r;
      } catch (err) {
        const hit = await caches.match('./m.html');
        if (hit) return hit;
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
          + '<body style="background:#061420;color:#8ba8b8;font:14px/1.7 system-ui;padding:40px 24px;text-align:center">'
          + '<p>当前处于离线状态，本机还没有缓存到海图。</p>'
          + '<p>请联网后重新打开一次。</p></body>',
          { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && r.ok && new URL(req.url).origin === self.location.origin) {
        const c = await caches.open(VER);
        c.put(req, r.clone()).catch(() => {});
      }
      return r;
    } catch (err) {
      return Response.error();
    }
  })());
});
