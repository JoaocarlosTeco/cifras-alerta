// Converte cifras coladas (texto com os acordes em cima da letra) para musicas/*.cho.
//
// 1. Copie a cifra do site, já no tom que você quer.
// 2. Cole num arquivo de texto em colar/, com o nome da música: colar/casa.txt
//    (se a música ainda não existe aqui, a primeira linha do arquivo é o título).
// 3. Rode:  npm run colar
//
// Se já existe uma ficha em musicas/ com o mesmo nome, o título, o artista e a
// categoria dela são mantidos e só a cifra entra.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerChordPro, primeiroAcorde, slugificar, tomDoAcorde } from '../js/cifra.js';
import { arrumarTitulo, converterCorpo } from './conversor.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pastaColar = path.join(raiz, 'colar');
const pastaMusicas = path.join(raiz, 'musicas');

/** Texto colado + ficha existente (ou null) -> conteúdo do .cho. */
export function converterColado(texto, ficha, nomeDoArquivo) {
  let linhas = texto.replace(/\r/g, '').replace(/ /g, ' ').split('\n');
  let tom = '';
  linhas = linhas.filter((l) => {
    const m = /^\s*tom\s*:\s*([A-G][#b]?m?)/i.exec(l);
    if (m) tom = tom || m[1];
    return !m && !/^\s*(afina[cç][aã]o|capotraste)\s*:/i.test(l);
  });

  let titulo = ficha?.titulo || '';
  if (!titulo) {
    const i = linhas.findIndex((l) => l.trim());
    titulo = i >= 0 ? arrumarTitulo(linhas[i]) : arrumarTitulo(nomeDoArquivo.replace(/-/g, ' '));
    if (i >= 0) linhas.splice(i, 1);
  }

  const corpo = converterCorpo(linhas);
  tom = tom || tomDoAcorde(primeiroAcorde(corpo));
  const cabecalho = [`{title: ${titulo}}`];
  if (ficha?.artista) cabecalho.push(`{artist: ${ficha.artista}}`);
  if (tom) cabecalho.push(`{key: ${tom}}`);
  if (ficha?.categorias?.length) cabecalho.push(`{categoria: ${ficha.categorias.join(', ')}}`);
  return { titulo, cho: `${cabecalho.join('\n')}\n\n${corpo}\n` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(pastaColar, { recursive: true });
  const arquivos = fs.readdirSync(pastaColar).filter((f) => f.endsWith('.txt'));
  if (!arquivos.length) {
    console.log('Nenhum .txt em colar/. Cole a cifra num arquivo como colar/nome-da-musica.txt e rode de novo.');
  }
  const fichas = fs
    .readdirSync(pastaMusicas)
    .filter((f) => f.endsWith('.cho'))
    .map((f) => ({ slug: f.replace(/\.cho$/, ''), ...lerChordPro(fs.readFileSync(path.join(pastaMusicas, f), 'utf8')) }));

  const gravar = (origem, slug, texto, nome) => {
    const destino = path.join(pastaMusicas, `${slug}.cho`);
    const ficha = fichas.find((f) => f.slug === slug) || null;
    if (ficha?.linhas.length && !process.argv.includes('--forcar')) {
      console.log(`${origem}: ${slug}.cho já tem cifra; use --forcar para trocar.`);
      return;
    }
    const { titulo, cho } = converterColado(texto, ficha, nome);
    fs.writeFileSync(destino, cho);
    console.log(`${origem} -> musicas/${slug}.cho (${titulo})${ficha ? '' : '  [nova: coloque {categoria: ...}]'}`);
  };

  for (const arquivo of arquivos) {
    const texto = fs.readFileSync(path.join(pastaColar, arquivo), 'utf8');
    if (!texto.trim()) continue; // arquivo ainda vazio
    const blocos = separarColados(texto);
    if (!blocos.length) {
      const nome = arquivo.replace(/\.txt$/, '');
      gravar(arquivo, slugificar(nome), texto, nome);
      continue;
    }
    // Várias músicas num arquivo só: cada uma começa com "TítuloArtista" e, logo abaixo, "Tom: X".
    for (const bloco of blocos) {
      const ficha = acharFicha(bloco.cabecalho, fichas);
      if (ficha) gravar(`${arquivo} [${ficha.titulo}]`, ficha.slug, bloco.texto, ficha.slug);
      else gravar(`${arquivo} [${bloco.cabecalho}]`, slugificar(bloco.cabecalho), `${bloco.cabecalho}\n${bloco.texto}`, bloco.cabecalho);
    }
  }
}

function compacto(s) {
  return slugificar(s).replace(/-/g, '');
}

/** Separa um texto com várias cifras coladas em sequência. Sem cabeçalhos, devolve []. */
export function separarColados(texto) {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const inicios = [];
  linhas.forEach((l, i) => {
    if (!l.trim() || /^\s*tom\s*:/i.test(l)) return;
    const proxima = linhas.slice(i + 1).find((x) => x.trim());
    if (proxima && /^\s*tom\s*:/i.test(proxima)) inicios.push(i);
  });
  return inicios.map((ini, n) => ({
    cabecalho: linhas[ini].trim(),
    texto: linhas.slice(ini + 1, inicios[n + 1] ?? linhas.length).join('\n'),
  }));
}

/** Acha a ficha pelo cabeçalho colado ("TítuloArtista"); o artista desempata títulos iguais. */
export function acharFicha(cabecalho, fichas) {
  const c = compacto(cabecalho);
  const candidatas = fichas.filter((f) => f.titulo && c.startsWith(compacto(f.titulo)));
  if (candidatas.length <= 1) return candidatas[0] || null;
  const maior = Math.max(...candidatas.map((f) => compacto(f.titulo).length));
  const finalistas = candidatas.filter((f) => compacto(f.titulo).length === maior);
  return (
    finalistas.find((f) => {
      const resto = c.slice(maior);
      const artista = compacto(f.artista || '');
      return artista && (resto.includes(artista) || artista.includes(resto));
    }) || finalistas[0]
  );
}
