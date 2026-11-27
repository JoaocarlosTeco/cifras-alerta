// Guarda o app no aparelho para abrir sem internet (no ensaio, na igreja, no retiro).
// Arquivos do site: sempre tenta a versão nova; se a rede falhar ou demorar, usa a guardada.
// Fontes (Google Fonts): não mudam, então usa a guardada e só busca na primeira vez.

const CACHE = 'cifras-alerta-v2';
const ARQUIVOS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/cifra.js',
  './dados/musicas.js',
  './img/icone.svg',
  './img/icone-192.png',
  './manifest.webmanifest',
];
const FONTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function fonte(pedido) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(pedido);
  if (guardada) return guardada;
  const resposta = await fetch(pedido);
  if (resposta.ok || resposta.type === 'opaque') cache.put(pedido, resposta.clone());
  return resposta;
}

async function arquivoDoSite(pedido) {
  const cache = await caches.open(CACHE);
  try {
    const resposta = await Promise.race([
      fetch(pedido),
      new Promise((_, falhar) => setTimeout(() => falhar(new Error('rede lenta')), 4000)),
    ]);
    if (resposta.ok) cache.put(pedido, resposta.clone());
    return resposta;
  } catch {
    const guardada = await cache.match(pedido, { ignoreSearch: true });
    if (guardada) return guardada;
    if (pedido.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  }
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const origem = new URL(pedido.url).origin;
  if (FONTES.includes(origem)) evento.respondWith(fonte(pedido));
  else if (origem === self.location.origin) evento.respondWith(arquivoDoSite(pedido));
});
