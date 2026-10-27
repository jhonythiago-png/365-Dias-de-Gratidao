/* 365 Dias de Gratidão — service worker
   Estratégia "rede primeiro": com internet, o app sempre carrega a versão mais nova
   publicada no GitHub; sem internet, usa a cópia guardada no aparelho.
   Ao publicar uma atualização, você pode aumentar a VERSAO (opcional; serve para limpar caches antigos). */
const VERSAO = "g365-v4";
const ARQUIVOS = [
  "./", "./index.html", "./admin.html", "./manifest.webmanifest",
  "./css/app.css", "./css/admin.css",
  "./js/config.js", "./js/dados.js", "./js/arvore-dados.js", "./js/comum.js", "./js/app.js", "./js/admin.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSAO)
      .then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "atualizar") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const proprio = url.origin === self.location.origin;
  const externoFixo = url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com") || url.hostname === "cdn.jsdelivr.net";

  // Arquivos do app: rede primeiro (sempre a versão mais nova), cópia local só se estiver sem internet
  if (proprio) {
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((r) => {
          if (r && r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
          return r;
        })
        .catch(async () => {
          const salvo = await caches.match(req, { ignoreSearch: true });
          if (salvo) return salvo;
          if (req.mode === "navigate") return caches.match("./index.html");
          return Response.error();
        })
    );
    return;
  }

  // Fontes e biblioteca do Supabase (não mudam): cópia local primeiro
  if (externoFixo) {
    e.respondWith(
      caches.open(VERSAO).then(async (c) => {
        const salvo = await c.match(req);
        if (salvo) return salvo;
        const r = await fetch(req);
        if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone());
        return r;
      })
    );
  }
  // Supabase e demais endereços: sempre pela rede (sem interceptar)
});
