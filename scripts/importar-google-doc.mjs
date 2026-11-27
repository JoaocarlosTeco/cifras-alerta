// Importa as músicas do caderno no Google Docs para musicas/*.cho.
//
//   npm run importar -- <link-ou-id-do-doc>
//   npm run importar -- --arquivo caderno.md
//
// O doc precisa estar compartilhado como "qualquer pessoa com o link pode ver".
// Música que já tem arquivo em musicas/ não é sobrescrita (você pode ter
// corrigido algo nela); use --forcar para trocar mesmo assim.
// --categorias mapa.json  dá categoria às músicas novas: { "slug": ["Animação"] }.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { converterDoc } from './conversor.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pastaMusicas = path.join(raiz, 'musicas');

function lerArgumentos(args) {
  const op = { forcar: false, arquivo: null, doc: null, categorias: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--forcar') op.forcar = true;
    else if (a === '--arquivo') op.arquivo = args[++i];
    else if (a === '--categorias') op.categorias = args[++i];
    else if (!a.startsWith('--')) op.doc = a;
  }
  return op;
}

function idDoDoc(linkOuId) {
  const m = /\/document\/d\/([\w-]+)/.exec(linkOuId);
  return m ? m[1] : linkOuId;
}

async function baixarMarkdown(linkOuId) {
  const url = `https://docs.google.com/document/d/${idDoDoc(linkOuId)}/export?format=md`;
  const resposta = await fetch(url, { redirect: 'follow' });
  const tipo = resposta.headers.get('content-type') || '';
  if (!resposta.ok || tipo.includes('text/html')) {
    throw new Error(
      `Não consegui baixar o doc (HTTP ${resposta.status}). Confira se ele está compartilhado como "qualquer pessoa com o link".`,
    );
  }
  return resposta.text();
}

const op = lerArgumentos(process.argv.slice(2));
if (!op.doc && !op.arquivo) {
  console.error('Uso: npm run importar -- <link-do-google-doc>   ou   npm run importar -- --arquivo caderno.md');
  process.exit(1);
}

const markdown = op.arquivo ? fs.readFileSync(op.arquivo, 'utf8') : await baixarMarkdown(op.doc);
const categorias = op.categorias ? JSON.parse(fs.readFileSync(op.categorias, 'utf8')) : {};
const musicas = converterDoc(markdown, categorias);

fs.mkdirSync(pastaMusicas, { recursive: true });
const resumo = { novas: [], atualizadas: [], iguais: [], mantidas: [] };
for (const { slug, titulo, cho } of musicas) {
  const destino = path.join(pastaMusicas, `${slug}.cho`);
  const existe = fs.existsSync(destino);
  const atual = existe ? fs.readFileSync(destino, 'utf8') : null;
  if (atual === cho) resumo.iguais.push(titulo);
  else if (existe && !op.forcar) resumo.mantidas.push(titulo);
  else {
    fs.writeFileSync(destino, cho);
    (existe ? resumo.atualizadas : resumo.novas).push(titulo);
  }
}

console.log(`${musicas.length} músicas no doc.`);
if (resumo.novas.length) console.log(`Novas (${resumo.novas.length}): ${resumo.novas.join(', ')}`);
if (resumo.atualizadas.length) console.log(`Atualizadas (${resumo.atualizadas.length}): ${resumo.atualizadas.join(', ')}`);
if (resumo.iguais.length) console.log(`Sem mudança: ${resumo.iguais.length}`);
if (resumo.mantidas.length) {
  console.log(`Já existiam e ficaram como estão (${resumo.mantidas.length}): ${resumo.mantidas.join(', ')}`);
  console.log('Para trocar pelo que está no doc, rode de novo com --forcar.');
}
