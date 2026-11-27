// Núcleo das cifras: reconhece acordes, transpõe e lê arquivos ChordPro.
// Não depende de nada: roda no navegador e no Node (scripts e testes).

const SUSTENIDOS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BEMOIS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const INDICE = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
};

// Fundamental + acidente + complemento (m, 7M, 9, °, (5-), (9/11+/13)...) + baixo opcional.
const RE_ACORDE =
  /^([A-G])([#b]?)((?:maj|min|dim|aug|sus|add|m|M|°|º|ø|\+|-|#|b|\d|\([^()]*\))*)(?:\/([A-G])([#b]?))?$/;

/** Separa parênteses e pontuação em volta do acorde: "(F#m" -> "(", "F#m", "". */
export function separarAcorde(texto) {
  let antes = '';
  let nucleo = texto;
  let depois = '';
  while (nucleo.startsWith('(') && !RE_ACORDE.test(nucleo)) {
    antes += '(';
    nucleo = nucleo.slice(1);
  }
  while (/[)\].,;:]$/.test(nucleo) && !RE_ACORDE.test(nucleo)) {
    depois = nucleo.slice(-1) + depois;
    nucleo = nucleo.slice(0, -1);
  }
  return { antes, nucleo, depois };
}

export function ehAcorde(texto) {
  if (!texto) return false;
  return RE_ACORDE.test(separarAcorde(texto).nucleo);
}

/** Sobe ou desce o acorde em semitons. Mantém o que não for acorde. */
export function transporAcorde(texto, semitons, acidente = 'sustenido') {
  const passo = ((semitons % 12) + 12) % 12;
  if (!passo) return texto;
  const { antes, nucleo, depois } = separarAcorde(texto);
  const m = RE_ACORDE.exec(nucleo);
  if (!m) return texto;
  const notas = acidente === 'bemol' ? BEMOIS : SUSTENIDOS;
  const nota = (letra, acid) => notas[(INDICE[letra + acid] + passo) % 12];
  let novo = nota(m[1], m[2]) + m[3];
  if (m[4]) novo += '/' + nota(m[4], m[5]);
  return antes + novo + depois;
}

/** Tom sugerido por um acorde: "F9" -> "F", "C#m7" -> "C#m". */
export function tomDoAcorde(texto) {
  const m = RE_ACORDE.exec(separarAcorde(texto || '').nucleo);
  if (!m) return '';
  const menor = /^m(?!aj)/.test(m[3]) || m[3].startsWith('min');
  return m[1] + m[2] + (menor ? 'm' : '');
}

/** Sem acentos e em minúsculas, para busca. */
export function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function slugificar(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const DIRETIVAS_SECAO = new Set(['comment', 'c', 'comment_italic', 'ci', 'comment_box', 'cb', 'highlight']);
// Texto que pode aparecer numa linha só de acordes sem virar letra.
const RE_SO_ENFEITE = /^[\s()|.\-–x\d]*$/i;

/**
 * Lê o texto ChordPro e devolve { titulo, artista, tom, linhas }.
 * Cada linha é { tipo: 'vazia' } | { tipo: 'secao', texto } |
 * { tipo: 'letra' | 'acordes', partes: [{ acorde, anotacao, texto }] }.
 */
export function lerChordPro(texto) {
  const musica = { titulo: '', artista: '', tom: '', categorias: [], link: '', linhas: [] };
  const linhas = musica.linhas;
  const vazia = () => {
    if (linhas.length && linhas[linhas.length - 1].tipo !== 'vazia') linhas.push({ tipo: 'vazia' });
  };

  for (const bruta of String(texto).replace(/\r/g, '').split('\n')) {
    const linha = bruta.replace(/\s+$/, '');
    if (linha.startsWith('#')) continue;

    const diretiva = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i.exec(linha);
    if (diretiva) {
      const nome = diretiva[1].toLowerCase();
      const valor = diretiva[2] || '';
      if (nome === 'title' || nome === 't') musica.titulo = valor;
      else if (nome === 'artist' || nome === 'subtitle' || nome === 'st') musica.artista = valor;
      else if (nome === 'key') musica.tom = valor;
      else if (nome === 'link') musica.link = valor.trim();
      else if (nome === 'categoria' || nome === 'categorias' || nome === 'tag') {
        for (const c of valor.split(',').map((x) => x.trim()).filter(Boolean)) {
          if (!musica.categorias.includes(c)) musica.categorias.push(c);
        }
      }
      else if (DIRETIVAS_SECAO.has(nome)) {
        vazia();
        linhas.push({ tipo: 'secao', texto: valor });
      } else if (nome === 'start_of_chorus' || nome === 'soc') {
        vazia();
        linhas.push({ tipo: 'secao', texto: valor || 'Refrão' });
      }
      continue;
    }

    if (!linha.trim()) {
      vazia();
      continue;
    }

    const partes = [];
    const re = /\[([^\]]*)\]/g;
    let fim = 0;
    let atual = { acorde: null, anotacao: false, texto: '' };
    let m;
    while ((m = re.exec(linha))) {
      atual.texto += linha.slice(fim, m.index);
      if (atual.acorde || atual.texto) partes.push(atual);
      const anotacao = m[1].startsWith('*');
      atual = { acorde: anotacao ? m[1].slice(1) : m[1], anotacao, texto: '' };
      fim = re.lastIndex;
    }
    atual.texto += linha.slice(fim);
    if (atual.acorde || atual.texto) partes.push(atual);

    const temAcorde = partes.some((p) => p.acorde);
    const soAcordes = temAcorde && partes.every((p) => RE_SO_ENFEITE.test(p.texto));
    linhas.push({ tipo: soAcordes ? 'acordes' : 'letra', partes });
  }

  while (linhas.length && linhas[linhas.length - 1].tipo === 'vazia') linhas.pop();
  return musica;
}

/** Primeiro acorde de verdade do texto ChordPro (para descobrir o tom). */
export function primeiroAcorde(texto) {
  for (const m of String(texto).matchAll(/\[([^\]*][^\]]*)\]/g)) {
    if (ehAcorde(m[1])) return separarAcorde(m[1]).nucleo;
  }
  return '';
}

/** Só a letra, sem acordes nem diretivas (para a busca por trecho). */
export function letraPura(texto) {
  return String(texto)
    .split('\n')
    .filter((l) => !/^\s*[{#]/.test(l))
    .map((l) => l.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l && !RE_SO_ENFEITE.test(l))
    .join('\n');
}
