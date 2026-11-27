// Converte o caderno de cifras (Google Docs exportado em Markdown) para ChordPro.
// No doc os acordes ficam numa linha em cima da letra, alinhados por espaços:
// cada acorde vai para dentro da letra na mesma coluna, no formato [Acorde].

import { ehAcorde, primeiroAcorde, slugificar, tomDoAcorde } from '../js/cifra.js';

const RE_TITULO = /^\s*\*\*([^`*]+?)\*\*\s*$/;
const RE_ENFEITE = /^(\(|\)|\||-|–|\/|\.{2,}|x?\d+x?|\([^()\s]+\))$/i;
const RE_ROTULO_COLCHETES = /^\s*\[([^\]]+)\]\s*(.*)$/;
const RE_ROTULO_SOLTO =
  /^\s*((?:pr[eé][- ]?)?refr[aã]o(?: final)?|intro(?:du[cç][aã]o)?|solo|ponte|final|interl[uú]dio|coro|ponte|\d+ª parte|(?:primeira|segunda|terceira) parte)\s*:?\s*(.*)$/i;

// Artigos e preposições que ficam minúsculos no meio do título.
const MINUSCULAS = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'e', 'pra', 'com', 'por', 'um', 'uma']);
// Títulos que precisam de acento que o doc não tem.
const TITULOS = { 'tu es o centro': 'Tu És o Centro', 'eu preciso de voce': 'Eu Preciso de Você' };
// Correções na letra que não mudam o tamanho da palavra (não desalinham os acordes).
const CORRECOES = [
  [/\bespirito\b/gi, 'espírito'],
  [/\bjerico\b/gi, 'Jericó'],
];
const NOMES_SAGRADOS = /\b(deus|jesus|cristo|senhor|espírito santo|maria)\b/gi;

export function limparLinhaMd(linha) {
  return linha
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, '$1')
    .replace(/\t/g, '    ')
    .replace(/\s+$/, '');
}

export function arrumarTitulo(titulo) {
  const limpo = titulo.replace(/\s+/g, ' ').trim();
  const chave = limpo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (TITULOS[chave]) return TITULOS[chave];
  return limpo
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** Ajusta a letra sem mudar o tamanho: tira CAIXA ALTA, começa com maiúscula, nomes sagrados. */
export function arrumarLetra(linha) {
  let l = linha;
  const letras = l.replace(/[^\p{L}]/gu, '');
  if (letras.length >= 4 && letras === letras.toUpperCase()) l = l.toLowerCase();
  for (const [re, troca] of CORRECOES) l = l.replace(re, troca);
  l = l.replace(NOMES_SAGRADOS, (m) => m.replace(/(^|\s)(\p{L})/gu, (_, e, c) => e + c.toUpperCase()));
  return l.replace(/^(\s*)(\p{Ll})/u, (_, e, c) => e + c.toUpperCase());
}

/** "C#9C#m" (faltou espaço no doc) vira "C#9" e "C#m". */
function desgrudar(txt) {
  if (ehAcorde(txt)) return [txt];
  for (let i = 1; i < txt.length; i++) {
    if (/[A-G]/.test(txt[i]) && ehAcorde(txt.slice(0, i))) {
      const resto = desgrudar(txt.slice(i));
      if (resto.every(ehAcorde)) return [txt.slice(0, i), ...resto];
    }
  }
  return [txt];
}

function pedacos(linha) {
  return [...linha.matchAll(/\S+/g)].flatMap((m) => {
    let col = m.index;
    return desgrudar(m[0]).map((txt) => {
      const p = { col, txt };
      col += txt.length;
      return p;
    });
  });
}

export function ehLinhaDeAcordes(linha) {
  const t = pedacos(linha);
  if (!t.some((p) => ehAcorde(p.txt))) return false;
  if (!t.every((p) => ehAcorde(p.txt) || RE_ENFEITE.test(p.txt))) return false;
  // "A A A A A A" é a turma cantando a vogal, não acorde.
  if (t.length >= 4 && new Set(t.map((p) => p.txt)).size === 1) return false;
  return true;
}

function ehSujeira(linha) {
  return !/[\p{L}\d]/u.test(linha);
}

export function rotulo(linha) {
  const m = RE_ROTULO_COLCHETES.exec(linha);
  if (m && !ehAcorde(m[1]) && (!m[2].trim() || ehLinhaDeAcordes(m[2]))) return { nome: m[1].trim(), resto: m[2] };
  const s = RE_ROTULO_SOLTO.exec(linha);
  if (s && (!s[2].trim() || ehLinhaDeAcordes(s[2]))) {
    const nome = s[1].charAt(0).toUpperCase() + s[1].slice(1).toLowerCase();
    return { nome, resto: s[2] };
  }
  return null;
}

/** "(" gruda no acorde seguinte e ")" no anterior: "( A  E )" vira "(A" e "E)". */
function juntarParenteses(t) {
  const saida = [];
  let abre = '';
  for (const p of t) {
    if (p.txt === '(') {
      abre += '(';
      continue;
    }
    if (p.txt === ')' && saida.length) {
      saida[saida.length - 1].txt += ')';
      continue;
    }
    saida.push({ col: p.col, txt: abre + p.txt });
    abre = '';
  }
  return saida;
}

const marca = (txt) => (ehAcorde(txt) ? `[${txt}]` : `[*${txt}]`);

export function linhaSoDeAcordes(linha) {
  return juntarParenteses(pedacos(linha)).map((p) => marca(p.txt)).join('  ');
}

/** Coloca os acordes da linha de cima dentro da letra, na mesma coluna. */
export function mesclar(linhaAcordes, letra) {
  const t = juntarParenteses(pedacos(linhaAcordes));
  let texto = letra;
  const ultima = t.length ? t[t.length - 1].col : 0;
  if (texto.length < ultima) texto = texto.padEnd(ultima, ' ');
  for (let i = t.length - 1; i >= 0; i--) {
    const { col, txt } = t[i];
    texto = texto.slice(0, col) + marca(txt) + texto.slice(col);
  }
  return ajustarPosicoes(texto.replace(/^\s+/, '').replace(/\s+$/, ''));
}

/**
 * Corrige o desvio de uma coluna, comum quando o doc começa a linha de acordes
 * com um espaço: "V[E]im" -> "[E]Vim" e "Minha[Am7] alma" -> "Minha [Am7]alma".
 */
export function ajustarPosicoes(linha) {
  return linha
    .replace(/(^|[^\p{L}\]])(\p{L})(\[[^\]]+\])(?=\p{L})/gu, '$1$3$2')
    .replace(/(\p{L})(\[[^\]]+\]) (?=\p{L})/gu, '$1 $2');
}

/** Converte as linhas de uma música (já sem o título) em corpo ChordPro. */
export function converterCorpo(linhasMd) {
  const L = linhasMd.map(limparLinhaMd);
  const saida = [];
  const vazia = () => {
    const ultima = saida[saida.length - 1];
    if (saida.length && ultima !== '' && !ultima.startsWith('{c:')) saida.push('');
  };

  for (let i = 0; i < L.length; i++) {
    const linha = L[i];
    if (!linha.trim()) {
      vazia();
      continue;
    }

    const r = rotulo(linha);
    if (r) {
      vazia();
      saida.push(`{c: ${r.nome}}`);
      if (r.resto.trim()) saida.push(linhaSoDeAcordes(r.resto));
      continue;
    }

    if (ehLinhaDeAcordes(linha)) {
      const proxima = L[i + 1];
      const temLetraEmbaixo =
        proxima !== undefined && proxima.trim() && !ehLinhaDeAcordes(proxima) && !rotulo(proxima) && !ehSujeira(proxima);
      if (temLetraEmbaixo) {
        saida.push(mesclar(linha, arrumarLetra(proxima)));
        i++;
      } else {
        saida.push(linhaSoDeAcordes(linha));
      }
      continue;
    }

    if (ehSujeira(linha)) continue;
    saida.push(arrumarLetra(linha.trim()));
  }

  while (saida.length && saida[saida.length - 1] === '') saida.pop();
  while (saida.length && saida[0] === '') saida.shift();
  return saida.join('\n');
}

/** Separa o Markdown do doc em músicas: cada título em negrito começa uma. */
export function separarMusicas(markdown) {
  const musicas = [];
  let atual = null;
  for (const linha of markdown.replace(/\r/g, '').split('\n')) {
    if (/^\[image\d+\]:/.test(linha) || /!\[[^\]]*\]\[[^\]]*\]/.test(linha)) continue;
    const t = RE_TITULO.exec(linha);
    if (t && !ehLinhaDeAcordes(limparLinhaMd(linha))) {
      atual = { tituloOriginal: t[1].trim(), linhas: [] };
      musicas.push(atual);
      continue;
    }
    if (atual) atual.linhas.push(linha);
  }
  return musicas;
}

/** Markdown do doc -> [{ slug, titulo, cho }]. categorias: { slug: ['Adoração', ...] }. */
export function converterDoc(markdown, categorias = {}) {
  return separarMusicas(markdown).map(({ tituloOriginal, linhas }) => {
    const titulo = arrumarTitulo(tituloOriginal);
    const slug = slugificar(titulo);
    const corpo = converterCorpo(linhas);
    const tom = tomDoAcorde(primeiroAcorde(corpo));
    const cabecalho = [`{title: ${titulo}}`];
    if (tom) cabecalho.push(`{key: ${tom}}`);
    if (categorias[slug]?.length) cabecalho.push(`{categoria: ${categorias[slug].join(', ')}}`);
    return { slug, titulo, cho: `${cabecalho.join('\n')}\n\n${corpo}\n` };
  });
}
