// Servidor local para testar o app:  npm run servir  ->  http://localhost:4321
// Sem dependências. Na rede de casa, abra no celular pelo IP do computador.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const porta = Number(process.env.PORT) || 4321;
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.cho': 'text/plain; charset=utf-8',
};

http
  .createServer((pedido, resposta) => {
    const caminho = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
    let arquivo = path.normalize(path.join(raiz, caminho));
    if (!arquivo.startsWith(raiz)) {
      resposta.writeHead(403).end();
      return;
    }
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html');
    fs.readFile(arquivo, (erro, conteudo) => {
      if (erro) {
        resposta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
        return;
      }
      resposta.writeHead(200, {
        'Content-Type': tipos[path.extname(arquivo)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      resposta.end(conteudo);
    });
  })
  .listen(porta, () => {
    console.log(`Cifras Alerta em http://localhost:${porta}`);
    for (const lista of Object.values(os.networkInterfaces())) {
      for (const rede of lista || []) {
        if (rede.family === 'IPv4' && !rede.internal) console.log(`No celular (mesma rede): http://${rede.address}:${porta}`);
      }
    }
  });
