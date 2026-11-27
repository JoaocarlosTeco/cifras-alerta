// Junta musicas/*.cho e musicas/categorias.json em dados/musicas.js, que o app carrega.
// Rode depois de criar ou editar uma música:  npm run gerar

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ehAcorde, lerChordPro } from '../js/cifra.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pastaMusicas = path.join(raiz, 'musicas');

const categorias = JSON.parse(fs.readFileSync(path.join(pastaMusicas, 'categorias.json'), 'utf8'));
const conhecidas = new Set(categorias.map((c) => c.nome));
const avisos = [];
const musicas = [];

for (const arquivo of fs.readdirSync(pastaMusicas).filter((f) => f.endsWith('.cho')).sort()) {
  const cho = fs.readFileSync(path.join(pastaMusicas, arquivo), 'utf8').replace(/\r/g, '');
  const musica = lerChordPro(cho);
  const slug = arquivo.replace(/\.cho$/, '');

  if (!/^[a-z0-9-]+$/.test(slug)) avisos.push(`${arquivo}: use só letras minúsculas, números e hífen no nome do arquivo`);
  if (!musica.titulo) avisos.push(`${arquivo}: falta a linha {title: Nome da música}`);
  if (!musica.linhas.length && !musica.link) avisos.push(`${arquivo}: sem cifra e sem {link: ...}`);
  if (!musica.categorias.length) avisos.push(`${arquivo}: sem categoria; adicione {categoria: Adoração} (ou outra)`);
  for (const c of musica.categorias) {
    if (!conhecidas.has(c)) avisos.push(`${arquivo}: a categoria "${c}" não está em musicas/categorias.json`);
  }
  for (const linha of musica.linhas) {
    for (const parte of linha.partes || []) {
      if (parte.acorde && !parte.anotacao && !ehAcorde(parte.acorde)) {
        avisos.push(`${arquivo}: "[${parte.acorde}]" não parece acorde e não vai transpor (anotação? use [*${parte.acorde}])`);
      }
    }
  }

  musicas.push({
    slug,
    titulo: musica.titulo || slug,
    artista: musica.artista,
    tom: musica.tom,
    categorias: musica.categorias,
    link: musica.link,
    cho,
  });
}

musicas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));

const saida =
  '// Gerado por scripts/gerar.mjs a partir da pasta musicas/. Não edite aqui: edite o .cho e rode npm run gerar.\n' +
  `export const categorias = ${JSON.stringify(categorias, null, 2)};\n\n` +
  `export const musicas = ${JSON.stringify(musicas, null, 2)};\n`;

fs.mkdirSync(path.join(raiz, 'dados'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dados', 'musicas.js'), saida);

console.log(`${musicas.length} músicas em dados/musicas.js`);
for (const aviso of avisos) console.warn(`aviso: ${aviso}`);
