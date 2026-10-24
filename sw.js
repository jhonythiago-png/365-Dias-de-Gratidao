/* 365 Dias de Gratidão — service worker (funciona offline e abre rápido)
   Ao publicar uma atualização, aumente o número da VERSAO. */
const VERSAO = "g365-v1";
const ARQUIVOS = [
  "./", "./index.html", "./admin.html", "./manifest.webmanifest",
  "./css/app.css", "./css/admin.css",
  "./js/config.js", "./js/dados.js", "./js/arvore-dados.js", "./js/comum.js", "./js/app.js", "./js/admin.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const proprio = url.origin === self.location.origin;
  const fonte = url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com") || url.hostname === "cdn.jsdelivr.net";
  if (!proprio && !fonte) return; // Supabase e demais: sempre pela rede
  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const salvo = await cache.match(req);
      const rede = fetch(req).then((r) => { if (r && (r.ok || r.type === "opaque")) cache.put(req, r.clone()); return r; }).catch(() => salvo);
      return salvo || rede;
    })
  );
});
