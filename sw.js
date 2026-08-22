/* 筋トレノート – service worker */
/* 中身を書きかえたら CACHE の番号を上げること（端末の古いキャッシュを捨てさせるため） */
const CACHE = "kintore-note-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* キャッシュ優先＋裏で更新。裏の更新は waitUntil で守らないと
   応答を返した時点で SW が止められて、更新が永遠に終わらない */
function cacheFirst(e, req) {
  return caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      const copy = res.clone();
      e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)));
      return res;
    }).catch(() => hit);
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Google Fonts は取れたらキャッシュ、ダメならキャッシュから
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    e.respondWith(cacheFirst(e, req));
    return;
  }

  if (url.origin !== location.origin) return;

  // 本体（index.html）はアプリのコードそのもの。ネット優先にしないと
  // メニューを直しても端末に古いままの画面が出続ける
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // アイコンなど中身の変わらないものはキャッシュ優先のまま
  e.respondWith(cacheFirst(e, req));
});
