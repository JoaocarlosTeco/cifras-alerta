import { categorias, musicas } from '../dados/musicas.js';
import { lerChordPro, letraPura, normalizar, transporAcorde } from './cifra.js';

const $ = (seletor) => document.querySelector(seletor);
const app = $('.app');
const computador = window.matchMedia('(min-width: 960px)');

// ---------- Preferências guardadas no aparelho ----------

const pref = {
  ler(chave, padrao) {
    try {
      const valor = localStorage.getItem(`cifras:${chave}`);
      return valor === null ? padrao : JSON.parse(valor);
    } catch {
      return padrao;
    }
  },
  gravar(chave, valor) {
    try {
      localStorage.setItem(`cifras:${chave}`, JSON.stringify(valor));
    } catch {
      /* navegador sem armazenamento: segue sem guardar */
    }
  },
};

const limitar = (n, min, max) => Math.min(max, Math.max(min, Number(n) || min));
const TAMANHO = { min: 14, max: 34, padrao: 19 };
const VELOCIDADES = [0, 9, 13, 18, 24, 31, 39, 49, 61, 75, 92]; // pixels por segundo

// Nomes antigos (claro/escuro) continuam válidos para quem já escolheu um tema.
const TEMAS = { branco: 'branco', preto: 'preto', claro: 'branco', escuro: 'preto', auto: 'auto' };

const estado = {
  categoria: 'Todas',
  busca: '',
  tamanho: limitar(pref.ler('tamanho', TAMANHO.padrao), TAMANHO.min, TAMANHO.max),
  acidente: pref.ler('acidente', 'sustenido') === 'bemol' ? 'bemol' : 'sustenido',
  acordes: pref.ler('acordes', true) !== false,
  colunas: pref.ler('colunas', false) === true,
  tema: TEMAS[pref.ler('tema', 'auto')] || 'auto',
  velocidade: limitar(pref.ler('velocidade', 3), 1, 10),
  rolando: false,
  atual: null,
  ordem: [],
};

// ---------- Ícones (traço, 24x24) ----------

const ICONES = {
  // ostensório
  'Adoração':
    '<circle cx="12" cy="9" r="3.2"/><path d="M12 2.6v1.6M12 14.6v6.9M5.6 9h1.6M16.8 9h1.6M7.5 4.5l1.1 1.1M15.4 12.4l1.1 1.1M16.5 4.5l-1.1 1.1M8.6 12.4l-1.1 1.1M8.4 21.5h7.2"/>',
  // chama
  'Espírito Santo':
    '<path d="M12 21.5c-3.6 0-6.2-2.5-6.2-6 0-2.6 1.6-4.3 3-6 .3 1.4.9 2.3 1.9 2.9-.4-3.3.6-6.9 3.3-9.9.2 3.2 1.7 4.9 2.9 6.7 1 1.5 1.3 3 1.3 5.1 0 3.9-2.5 7.2-6.2 7.2z"/>',
  // tau
  'Entrega': '<path d="M5 4.5h14l-.8 5.2-4.3-1 1 11.8H9.1l1-11.8-4.3 1z"/>',
  // livro aberto
  'Reflexão':
    '<path d="M12 6.3C10.2 4.9 7.6 4.4 4 4.7v13.2c3.6-.3 6.2.2 8 1.6 1.8-1.4 4.4-1.9 8-1.6V4.7c-3.6-.3-6.2.2-8 1.6zM12 6.3v13.2"/>',
  // tambor
  'Animação':
    '<ellipse cx="12" cy="8" rx="7.5" ry="2.5"/><path d="M4.5 8v8c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V8"/><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5M8.5 2l2.6 4.2M15.5 2l-2.6 4.2"/>',
};
const ICONE_PADRAO = '<path d="M10 18V5l9-2v12"/><circle cx="7.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>';
const ICONE_SETA_ESQ = '<path d="M15 5l-7 7 7 7"/>';
const ICONE_SETA_DIR = '<path d="M9 5l7 7-7 7"/>';

function svg(conteudo) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = conteudo;
  return el;
}
const icone = (categoria) => svg(ICONES[categoria] || ICONE_PADRAO);

// ---------- Índice para a busca (sem acento, sem pontuação) ----------

const simplificar = (texto) => normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim();
// Mesmo tamanho do texto original, para saber onde marcar o trecho encontrado.
const porLetra = (texto) =>
  texto
    .split('')
    .map((ch) => {
      const n = normalizar(ch);
      return /^[a-z0-9]$/.test(n) ? n : ' ';
    })
    .join('');

const nomesCategorias = [
  ...categorias.map((c) => c.nome),
  ...new Set(musicas.flatMap((m) => m.categorias).filter((c) => !categorias.some((k) => k.nome === c))),
];
const descricoes = new Map(categorias.map((c) => [c.nome, c.descricao]));

const indice = musicas.map((m) => {
  const linhas = letraPura(m.cho).split('\n').filter(Boolean);
  const linhasN = linhas.map(simplificar);
  return {
    ...m,
    linhas,
    linhasN,
    tituloN: simplificar(m.titulo),
    artistaN: simplificar(m.artista || ''),
    textoN: linhasN.join(' '),
    // Embaixo do título: o artista; sem artista, a primeira frase que não seja anotação entre parênteses.
    primeira: m.artista || linhas.find((l) => !/^\(.*\)$/.test(l.trim())) || '',
  };
});
const porSlug = new Map(indice.map((m) => [m.slug, m]));
const daCategoria = (nome) => indice.filter((m) => m.categorias.includes(nome));
const plural = (n) => `${n} ${n === 1 ? 'música' : 'músicas'}`;

const cifrasLidas = new Map();
const lerCifra = (m) => {
  if (!cifrasLidas.has(m.slug)) cifrasLidas.set(m.slug, lerChordPro(m.cho));
  return cifrasLidas.get(m.slug);
};

function linhaDaPosicao(m, posicao) {
  let inicio = 0;
  for (let i = 0; i < m.linhasN.length; i++) {
    const fim = inicio + m.linhasN[i].length;
    if (posicao <= fim) return i;
    inicio = fim + 1;
  }
  return -1;
}

/** Procura no título e na letra. Todas as palavras precisam aparecer; frase inteira vale mais. */
function buscar(consulta, base) {
  const q = simplificar(consulta);
  if (!q) return null;
  const palavras = q.split(' ');
  const resultados = [];

  for (const m of base) {
    const tudo = `${m.tituloN} ${m.artistaN} ${m.textoN}`;
    if (!palavras.every((p) => tudo.includes(p))) continue;

    let pontos = 0;
    if (m.tituloN === q) pontos = 1000;
    else if (m.tituloN.startsWith(q)) pontos = 700;
    else if (m.tituloN.includes(q)) pontos = 500;
    else if (palavras.every((p) => m.tituloN.includes(p))) pontos = 350;
    const peloTitulo = pontos > 0;

    let linha = m.linhasN.findIndex((l) => l.includes(q));
    if (linha >= 0) pontos += 200;
    else {
      const posicao = m.textoN.indexOf(q);
      if (posicao >= 0) {
        linha = linhaDaPosicao(m, posicao);
        pontos += 150;
      } else if (!peloTitulo) {
        let melhor = 0;
        m.linhasN.forEach((l, i) => {
          const achadas = palavras.filter((p) => l.includes(p)).length;
          if (achadas > melhor) {
            melhor = achadas;
            linha = i;
          }
        });
        pontos += 20 * melhor;
      }
    }
    const inteiras = palavras.filter((p) => new RegExp(`(^| )${p}( |$)`).test(tudo)).length;
    pontos += inteiras * 5;
    resultados.push({ m, pontos, linha });
  }

  return resultados.sort((a, b) => b.pontos - a.pontos || a.m.titulo.localeCompare(b.m.titulo, 'pt-BR'));
}

/** Devolve o texto com <mark> no trecho buscado (ignora acento e pontuação). */
function marcarTrecho(texto, consulta) {
  const q = simplificar(consulta);
  const frag = document.createDocumentFragment();
  if (!q) {
    frag.append(texto);
    return frag;
  }
  const base = porLetra(texto);
  const palavras = q.split(' ');
  const faixas = [];
  const procurar = (re) => {
    for (const m of base.matchAll(re)) faixas.push([m.index, m.index + m[0].length]);
  };
  procurar(new RegExp(palavras.join(' +'), 'g'));
  if (!faixas.length) palavras.forEach((p) => procurar(new RegExp(p, 'g')));
  faixas.sort((a, b) => a[0] - b[0]);

  let pos = 0;
  for (const [ini, fim] of faixas) {
    if (ini < pos) continue;
    frag.append(texto.slice(pos, ini));
    const mark = document.createElement('mark');
    mark.textContent = texto.slice(ini, fim);
    frag.append(mark);
    pos = fim;
  }
  frag.append(texto.slice(pos));
  return frag;
}

// ---------- Lista ----------

function criar(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function itemDaLista(m, { trecho = null, consulta = '', mostrarCategorias = false } = {}) {
  const li = criar('li');
  const a = criar('a', 'item');
  a.href = `#/m/${m.slug}${consulta ? `?q=${encodeURIComponent(consulta)}` : ''}`;
  a.dataset.slug = m.slug;

  const titulo = criar('span', 'item-titulo');
  titulo.append(consulta ? marcarTrecho(m.titulo, consulta) : m.titulo);
  const sub = criar('span', trecho !== null ? 'item-sub trecho' : 'item-sub');
  sub.append(trecho !== null ? marcarTrecho(trecho, consulta) : m.primeira);
  a.append(titulo, sub);

  if (mostrarCategorias && m.categorias.length) a.append(criar('span', 'item-cats', m.categorias.join(', ')));
  if (m.tom) {
    const tom = criar('span', 'item-tom', m.tom);
    tom.title = `Tom original: ${m.tom}`;
    a.append(tom);
  }
  li.append(a);
  return li;
}

function listaDeItens(lista, opcoes) {
  const ul = criar('ul', 'itens');
  for (const m of lista) ul.append(itemDaLista(m, opcoes));
  return ul;
}

function desenharBlocos() {
  const caixa = $('#blocos');
  caixa.replaceChildren();
  for (const nome of nomesCategorias) {
    const n = daCategoria(nome).length;
    if (!n) continue;
    const b = criar('button', 'bloco');
    b.type = 'button';
    b.dataset.categoria = nome;
    b.setAttribute('aria-label', `${nome}, ${plural(n)}`);
    b.append(icone(nome), criar('span', 'bloco-num', String(n)), criar('span', 'bloco-nome', nome));
    caixa.append(b);
  }
}

function desenharCategorias() {
  const caixa = $('#categorias');
  caixa.replaceChildren();
  const opcoes = [{ nome: 'Todas', n: indice.length }].concat(
    nomesCategorias.map((nome) => ({ nome, n: daCategoria(nome).length })),
  );
  for (const { nome, n } of opcoes) {
    if (!n) continue;
    const b = criar('button', 'chip');
    b.type = 'button';
    b.dataset.categoria = nome;
    b.setAttribute('aria-pressed', String(estado.categoria === nome));
    if (nome !== 'Todas') b.append(icone(nome));
    b.append(nome, criar('span', 'num', String(n)));
    caixa.append(b);
  }
}

function desenharLista() {
  const lista = $('#lista');
  const resumo = $('#resumo');
  lista.replaceChildren();
  if (estado.categoria !== 'Todas' && !nomesCategorias.includes(estado.categoria)) estado.categoria = 'Todas';

  const todas = estado.categoria === 'Todas';
  const base = todas ? indice : daCategoria(estado.categoria);
  const consulta = estado.busca.trim();
  const resultados = buscar(consulta, base);
  const inicio = todas && !resultados;

  // Na tela inicial as categorias são os blocos; depois viram a fileira de botões.
  $('#blocos').hidden = !inicio;
  $('#categorias').hidden = inicio;
  resumo.textContent = '';

  if (resultados) {
    const onde = todas ? '' : ` em ${estado.categoria}`;
    if (!resultados.length) {
      const nada = criar('div', 'nada');
      nada.append(criar('p', '', `Nenhuma música com “${consulta}”${onde}`));
      if (!todas) {
        const b = criar('button', '', 'Buscar em todas as categorias');
        b.type = 'button';
        b.dataset.categoria = 'Todas';
        nada.append(b);
      }
      lista.append(nada);
    } else {
      resumo.textContent = `${plural(resultados.length)} com “${consulta}”${onde}`;
      const ul = criar('ul', 'itens');
      for (const r of resultados) {
        const trecho = r.linha >= 0 ? r.m.linhas[r.linha] : null;
        ul.append(itemDaLista(r.m, { trecho, consulta, mostrarCategorias: true }));
      }
      lista.append(ul);
    }
    estado.ordem = resultados.map((r) => r.m.slug);
  } else if (todas) {
    const topo = criar('div', 'lista-titulo');
    topo.append(criar('h2', '', 'Todas as músicas'), criar('span', '', 'de A a Z'));
    lista.append(topo, listaDeItens(indice));
    estado.ordem = indice.map((m) => m.slug);
  } else {
    const topo = criar('header', 'grupo-topo');
    const selo = criar('span', 'grupo-icone');
    selo.append(icone(estado.categoria));
    const texto = criar('div');
    texto.append(criar('h2', '', estado.categoria));
    const descricao = descricoes.get(estado.categoria);
    texto.append(criar('p', '', descricao ? `${descricao} ${plural(base.length)}.` : `${plural(base.length)}.`));
    topo.append(selo, texto);
    lista.append(topo, listaDeItens(base));
    estado.ordem = base.map((m) => m.slug);
  }

  marcarAtualNaLista();
  if (estado.atual) desenharVizinhas();
}

function marcarAtualNaLista() {
  for (const a of document.querySelectorAll('.item')) {
    if (a.dataset.slug === estado.atual) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function escolherCategoria(nome) {
  estado.categoria = nome;
  desenharCategorias();
  desenharLista();
  // A lista mudou: começa do início dela, com a busca no topo (em "Todas", volta para a capa).
  const inicio = nome === 'Todas' && !estado.busca.trim() ? 0 : Math.max(0, $('#sentinela').offsetTop - 37);
  if (computador.matches) $('#painel-lista').scrollTop = inicio;
  else if (estado.atual) posicaoDaLista = inicio;
  else window.scrollTo(0, inicio);
  const chip = $('.chip[aria-pressed="true"]');
  if (chip) chip.parentElement.scrollLeft = chip.offsetLeft - 16;
}

// ---------- Música ----------

const chaveTom = (slug) => `tom:${slug}`;
const ajustarSemitons = (n) => {
  let s = ((Math.round(n) % 12) + 12) % 12;
  if (s > 6) s -= 12;
  return s;
};
const semitonsDe = (slug) => ajustarSemitons(pref.ler(chaveTom(slug), 0));
/** 3 -> "1½ tom acima", -1 -> "½ tom abaixo". */
const emTons = (semitons) => {
  const inteiro = Math.floor(Math.abs(semitons) / 2);
  const meio = Math.abs(semitons) % 2 ? '½' : '';
  const quanto = `${inteiro || ''}${meio}`;
  return `${quanto} ${inteiro > 1 || (inteiro === 1 && meio) ? 'tons' : 'tom'} ${semitons > 0 ? 'acima' : 'abaixo'}`;
};

function segmento(parte, transpor, texto, soEspaco = false) {
  // Acorde sem sílaba embaixo (fim da linha ou sobre espaço) ocupa o próprio lugar.
  const s = criar('span', soEspaco ? 's so-espaco fixo' : texto ? 's' : 's fixo');
  const c = criar('span', parte.anotacao ? 'c anot' : 'c', parte.anotacao ? parte.acorde : transpor(parte.acorde));
  const l = criar('span', 'l', texto);
  s.append(c, l);
  return s;
}

function linhaDeLetra(linha, transpor) {
  const div = criar('div', 'linha');
  const letra = linha.partes.map((p) => p.texto).join('');
  div.dataset.letra = letra;
  if (!linha.partes.some((p) => p.acorde)) {
    div.textContent = letra.replace(/\s+/g, ' ').trim();
    return div;
  }

  div.classList.add('com-acordes');
  const pedacos = [];
  for (const p of linha.partes) {
    const partes = p.texto.split(/(\s+)/).filter((x) => x !== '');
    if (!partes.length) pedacos.push({ ...p, texto: '' });
    else partes.forEach((t, i) => pedacos.push({ acorde: i === 0 ? p.acorde : null, anotacao: p.anotacao, texto: t }));
  }

  // Cada palavra fica inteira (com seus acordes) para a linha quebrar só entre palavras.
  let palavra = null;
  for (const pedaco of pedacos) {
    const espaco = pedaco.texto !== '' && !pedaco.texto.trim();
    if (espaco) {
      palavra = null;
      if (pedaco.acorde) div.append(segmento(pedaco, transpor, ' ', true));
      div.append(' ');
      continue;
    }
    if (!palavra) {
      palavra = criar('span', 'palavra');
      div.append(palavra);
    }
    palavra.append(pedaco.acorde ? segmento(pedaco, transpor, pedaco.texto) : pedaco.texto);
  }
  return div;
}

function linhaSoDeAcordes(linha, transpor) {
  const div = criar('div', 'linha so-acordes');
  for (const p of linha.partes) {
    if (p.acorde) div.append(criar('span', p.anotacao ? 'c anot' : 'c', p.anotacao ? p.acorde : transpor(p.acorde)));
    const resto = p.texto.trim();
    if (resto) div.append(criar('span', 'c anot', resto));
  }
  return div;
}

function desenharCifra(cifra, transpor) {
  const raiz = $('#cifra');
  raiz.replaceChildren();
  raiz.style.setProperty('--tam', `${estado.tamanho}px`);
  raiz.classList.toggle('sem-acordes', !estado.acordes);
  raiz.classList.toggle('duas-colunas', estado.colunas && computador.matches);

  let estrofe = null;
  let soRotulo = false;
  for (const linha of cifra.linhas) {
    if (linha.tipo === 'vazia') {
      if (!soRotulo) estrofe = null;
      continue;
    }
    if (linha.tipo === 'secao') {
      estrofe = criar('div', 'estrofe');
      raiz.append(estrofe);
      const rotulo = criar('div');
      rotulo.append(criar('span', /refr/i.test(linha.texto) ? 'secao refrao' : 'secao', linha.texto));
      estrofe.append(rotulo);
      soRotulo = true;
      continue;
    }
    if (!estrofe) {
      estrofe = criar('div', 'estrofe');
      raiz.append(estrofe);
    }
    soRotulo = false;
    estrofe.append(linha.tipo === 'acordes' ? linhaSoDeAcordes(linha, transpor) : linhaDeLetra(linha, transpor));
  }
  acomodarAcordes();
}

/**
 * Abre espaço só onde precisa: se um acorde ia encostar no anterior (mesma linha
 * visual), empurra a sílaba dele; se ia passar da margem direita, a palavra desce.
 */
function acomodarAcordes() {
  const raiz = $('#cifra');
  if (!estado.atual || !estado.acordes || !raiz.isConnected) return;
  const segmentos = raiz.querySelectorAll('.linha.com-acordes .s');
  for (const s of segmentos) {
    s.style.marginLeft = '';
    s.style.minWidth = '';
  }
  const folga = parseFloat(getComputedStyle(raiz).fontSize) * 0.42;
  for (const linha of raiz.querySelectorAll('.linha.com-acordes')) {
    const limite = linha.getBoundingClientRect().right;
    let anterior = null;
    for (const s of linha.querySelectorAll('.s')) {
      const c = s.firstElementChild;
      let r = c.getBoundingClientRect();
      if (anterior && Math.abs(r.top - anterior.top) < r.height / 2 && r.left < anterior.right + folga) {
        s.style.marginLeft = `${Math.ceil(anterior.right + folga - r.left)}px`;
        r = c.getBoundingClientRect();
      }
      if (r.right > limite + 1 && !s.classList.contains('fixo')) {
        s.style.minWidth = `${Math.ceil(r.width)}px`;
        r = c.getBoundingClientRect();
      }
      anterior = { right: r.right, top: r.top };
    }
  }
}

let esperaAcomodar = null;
function acomodarDepois() {
  cancelAnimationFrame(esperaAcomodar);
  esperaAcomodar = requestAnimationFrame(acomodarAcordes);
}
window.addEventListener('resize', acomodarDepois);
// A fonte dos acordes muda a largura deles: refaz as contas quando ela chega.
document.fonts?.ready.then(acomodarDepois);
document.fonts?.addEventListener?.('loadingdone', acomodarDepois);

function desenharVizinhas() {
  const nav = $('#vizinhas');
  nav.replaceChildren();
  const ordem = estado.ordem.includes(estado.atual) ? estado.ordem : indice.map((m) => m.slug);
  const i = ordem.indexOf(estado.atual);
  const link = (slug, classe, rotulo) => {
    const m = porSlug.get(slug);
    const a = criar('a', classe);
    a.href = `#/m/${slug}`;
    const pequeno = criar('small');
    if (classe === 'anterior') pequeno.append(svg(ICONE_SETA_ESQ), rotulo);
    else pequeno.append(rotulo, svg(ICONE_SETA_DIR));
    a.append(pequeno, criar('span', '', m.titulo));
    return a;
  };
  if (i > 0) nav.append(link(ordem[i - 1], 'anterior', 'Anterior'));
  if (i >= 0 && i < ordem.length - 1) nav.append(link(ordem[i + 1], 'proxima', 'Próxima'));
}

function desenharMusica() {
  const m = porSlug.get(estado.atual);
  if (!m) return;
  const cifra = lerCifra(m);
  const semitons = semitonsDe(m.slug);
  const transpor = (acorde) => transporAcorde(acorde, semitons, estado.acidente);

  $('#titulo').textContent = m.titulo;
  $('#barra-titulo').textContent = m.titulo;
  const artista = $('#artista');
  artista.textContent = cifra.artista;
  artista.hidden = !cifra.artista;

  const selos = $('#selos');
  selos.replaceChildren();
  for (const c of m.categorias) {
    const li = criar('li');
    const a = criar('a');
    a.href = '#/';
    a.dataset.categoria = c;
    a.title = `Ver as músicas de ${c}`;
    a.append(icone(c), c);
    li.append(a);
    selos.append(li);
  }

  const tomNovo = cifra.tom ? transpor(cifra.tom) : '';
  const folha = $('#tom-folha');
  const texto = $('#tom-atual');
  folha.textContent = tomNovo;
  folha.hidden = !tomNovo;
  texto.replaceChildren();
  if (semitons) {
    texto.append(criar('b', '', emTons(semitons)));
    texto.append(cifra.tom ? `o original é ${cifra.tom}` : 'do tom original');
  } else if (cifra.tom) {
    texto.append(criar('b', '', 'Tom original'));
  }
  $('#tom-linha').hidden = !tomNovo && !semitons;

  const botaoTom = $('#botao-tom');
  $('#tom-botao').textContent = tomNovo || (semitons ? `${semitons > 0 ? '+' : '−'}${Math.abs(semitons)}` : '0');
  botaoTom.classList.toggle('mudou', semitons !== 0);
  botaoTom.setAttribute('aria-label', semitons ? `Tom ${tomNovo}, ${emTons(semitons)}. Mudar o tom` : `Tom ${tomNovo || 'original'}. Mudar o tom`);
  $('#tom-painel').textContent = tomNovo || (semitons ? emTons(semitons) : 'Original');
  $('#tom-voltar').disabled = semitons === 0;
  $('#tom-voltar').textContent = semitons === 0 ? 'Tom original' : `Voltar ao original${cifra.tom ? ` (${cifra.tom})` : ''}`;
  $('#letra-painel').textContent = String(estado.tamanho);

  const semCifra = cifra.linhas.length === 0;
  $('#controles').hidden = semCifra;
  if (semCifra) desenharSemCifra(cifra);
  else desenharCifra(cifra, transpor);
  desenharVizinhas();
}

/** Ficha só com link: a cifra fica no site de origem e não é copiada para o repo. */
function desenharSemCifra(cifra) {
  const raiz = $('#cifra');
  raiz.replaceChildren();
  const cartao = criar('div', 'sem-cifra');
  cartao.append(criar('p', '', 'Esta música ainda não tem cifra aqui.'));
  if (cifra.link) {
    const a = criar('a', 'link-cifra', 'Abrir a cifra');
    a.href = cifra.link;
    a.target = '_blank';
    a.rel = 'noopener';
    const site = criar('small', 'link-site', new URL(cifra.link).hostname.replace(/^www\./, ''));
    a.append(' ', site);
    cartao.append(a);
  }
  raiz.append(cartao);
}

let posicaoDaLista = 0;

function abrirMusica(slug, { semitons, consulta } = {}) {
  const mudou = estado.atual !== slug;
  if (!estado.atual && !computador.matches) posicaoDaLista = window.scrollY;
  if (mudou) {
    pararRolagem();
    fecharPaineis();
    app.classList.remove('imersivo');
  }
  estado.atual = slug;
  if (semitons !== undefined) pref.gravar(chaveTom(slug), ajustarSemitons(semitons));

  app.classList.add('vendo-musica');
  $('#musica').hidden = false;
  $('#controles').hidden = false;
  desenharMusica();
  marcarAtualNaLista();
  document.title = `${porSlug.get(slug).titulo} · Cifras Alerta`;
  pintarBarraDoNavegador();

  if (consulta) requestAnimationFrame(() => destacarTrecho(consulta));
  else if (mudou) window.scrollTo(0, 0);

  if (computador.matches) {
    $(`.item[data-slug="${slug}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  manterTelaLigada(true);
  mostrarDicasNaPrimeiraVez();
}

// ---------- Barra: painéis de Tom e Letra, esconder com um toque, dicas ----------

const PAINEIS = { tom: ['#painel-tom', '#botao-tom'], letra: ['#painel-letra', '#botao-letra'] };

function fecharPaineis() {
  for (const [painel, botao] of Object.values(PAINEIS)) {
    $(painel).hidden = true;
    $(botao).setAttribute('aria-expanded', 'false');
  }
}

function alternarPainel(nome) {
  const [painel, botao] = PAINEIS[nome];
  const abrir = $(painel).hidden;
  fecharPaineis();
  if (!abrir) return;
  pararRolagem(); // o painel abre no mesmo lugar do controle de velocidade
  $(painel).hidden = false;
  $(botao).setAttribute('aria-expanded', 'true');
}

const algumPainelAberto = () => Object.values(PAINEIS).some(([painel]) => !$(painel).hidden);

function mostrarDicasNaPrimeiraVez() {
  if (pref.ler('dicas-vistas', false) === true) return;
  $('#dicas').hidden = false;
  $('#dicas button')?.focus();
}

function fecharDicas() {
  if ($('#dicas').hidden) return;
  $('#dicas').hidden = true;
  pref.gravar('dicas-vistas', true);
}

function fecharMusica() {
  pararRolagem();
  fecharOpcoes();
  fecharPaineis();
  app.classList.remove('imersivo');
  manterTelaLigada(false);
  const estava = estado.atual;
  estado.atual = null;
  app.classList.remove('vendo-musica');
  $('#musica').hidden = true;
  $('#controles').hidden = true;
  document.title = 'Cifras Alerta';
  marcarAtualNaLista();
  pintarBarraDoNavegador();
  if (estava && !computador.matches) requestAnimationFrame(() => window.scrollTo(0, posicaoDaLista));
}

function destacarTrecho(consulta) {
  const q = simplificar(consulta);
  if (!q) return;
  const palavras = q.split(' ');
  const linhas = [...document.querySelectorAll('#cifra .linha[data-letra]')];
  let alvo = linhas.find((l) => simplificar(l.dataset.letra).includes(q));
  if (!alvo) {
    let melhor = 0;
    for (const l of linhas) {
      const texto = simplificar(l.dataset.letra);
      const achadas = palavras.filter((p) => texto.includes(p)).length;
      if (achadas > melhor) {
        melhor = achadas;
        alvo = l;
      }
    }
  }
  if (!alvo) return;
  alvo.scrollIntoView({ block: 'center' });
  alvo.classList.remove('destaque');
  void alvo.offsetWidth;
  alvo.classList.add('destaque');
}

function transpor(passo) {
  if (!estado.atual) return;
  const novo = ajustarSemitons(semitonsDe(estado.atual) + passo);
  pref.gravar(chaveTom(estado.atual), novo);
  desenharMusica();
}

function voltarAoTomOriginal() {
  if (!estado.atual) return;
  if (semitonsDe(estado.atual) === 0) return;
  pref.gravar(chaveTom(estado.atual), 0);
  desenharMusica();
  avisar('Voltou ao tom original');
}

function mudarTamanho(passo) {
  estado.tamanho = limitar(estado.tamanho + passo, TAMANHO.min, TAMANHO.max);
  pref.gravar('tamanho', estado.tamanho);
  $('#cifra').style.setProperty('--tam', `${estado.tamanho}px`);
  $('#letra-painel').textContent = String(estado.tamanho);
  acomodarAcordes();
}

function irParaVizinha(direcao) {
  const seletor = direcao > 0 ? '#vizinhas .proxima' : '#vizinhas .anterior';
  const link = $(seletor);
  if (link) location.hash = link.getAttribute('href');
}

// ---------- Rolagem automática ----------

let ultimoQuadro = null;
let sobra = 0;

function passoDaRolagem(agora) {
  if (!estado.rolando) return;
  if (ultimoQuadro !== null) {
    sobra += (VELOCIDADES[estado.velocidade] * (agora - ultimoQuadro)) / 1000;
    const px = Math.floor(sobra);
    if (px >= 1) {
      window.scrollBy(0, px);
      sobra -= px;
    }
  }
  ultimoQuadro = agora;
  const fim = document.documentElement.scrollHeight - window.innerHeight - 2;
  if (window.scrollY >= fim) {
    pararRolagem();
    return;
  }
  requestAnimationFrame(passoDaRolagem);
}

function iniciarRolagem() {
  fecharPaineis();
  estado.rolando = true;
  ultimoQuadro = null;
  sobra = 0;
  $('#botao-rolar').setAttribute('aria-pressed', 'true');
  $('#rolagem-velocidade').hidden = false;
  $('#velocidade').textContent = String(estado.velocidade);
  requestAnimationFrame(passoDaRolagem);
}

function pararRolagem() {
  estado.rolando = false;
  $('#botao-rolar').setAttribute('aria-pressed', 'false');
  $('#rolagem-velocidade').hidden = true;
}

function mudarVelocidade(passo) {
  estado.velocidade = limitar(estado.velocidade + passo, 1, 10);
  pref.gravar('velocidade', estado.velocidade);
  $('#velocidade').textContent = String(estado.velocidade);
}

// ---------- Tela ligada enquanto a cifra está aberta ----------

let travaDeTela = null;

async function manterTelaLigada(ligar) {
  try {
    if (ligar && 'wakeLock' in navigator && !travaDeTela && document.visibilityState === 'visible') {
      travaDeTela = await navigator.wakeLock.request('screen');
      travaDeTela.addEventListener('release', () => {
        travaDeTela = null;
      });
    } else if (!ligar && travaDeTela) {
      await travaDeTela.release();
      travaDeTela = null;
    }
  } catch {
    travaDeTela = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && estado.atual) manterTelaLigada(true);
});

// ---------- Opções ----------

/** A barra do navegador do celular acompanha o topo da tela: preta na capa, cor do fundo na cifra. */
function pintarBarraDoNavegador() {
  const estilo = getComputedStyle(document.documentElement);
  const buscando = $('#painel-lista').classList.contains('buscando');
  const naCapa = (!estado.atual || computador.matches) && !buscando;
  const cor = estilo.getPropertyValue(naCapa ? '--capa' : '--fundo').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);
}

function aplicarTema() {
  if (estado.tema === 'branco' || estado.tema === 'preto') document.documentElement.dataset.tema = estado.tema;
  else delete document.documentElement.dataset.tema;
  pintarBarraDoNavegador();
}

function desenharOpcoes() {
  $('#chave-acordes').setAttribute('aria-checked', String(estado.acordes));
  $('#chave-colunas').setAttribute('aria-checked', String(estado.colunas));
  for (const b of document.querySelectorAll('[data-acidente]')) {
    b.setAttribute('aria-checked', String(b.dataset.acidente === estado.acidente));
  }
  for (const b of document.querySelectorAll('[data-tema]')) {
    b.setAttribute('aria-checked', String(b.dataset.tema === estado.tema));
  }
}

function abrirOpcoes() {
  desenharOpcoes();
  $('#opcoes').hidden = false;
  $('#botao-mais').setAttribute('aria-expanded', 'true');
  $('#opcoes button')?.focus();
}

function fecharOpcoes() {
  if ($('#opcoes').hidden) return;
  $('#opcoes').hidden = true;
  $('#botao-mais').setAttribute('aria-expanded', 'false');
}

let temporizadorAviso = null;
function avisar(texto) {
  const aviso = $('#aviso');
  aviso.textContent = texto;
  aviso.classList.add('visivel');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('visivel'), 2200);
}

async function compartilhar() {
  const m = porSlug.get(estado.atual);
  if (!m) return;
  const semitons = semitonsDe(m.slug);
  const url = `${location.origin}${location.pathname}#/m/${m.slug}${semitons ? `?t=${semitons}` : ''}`;
  const tom = m.tom ? ` (tom ${transporAcorde(m.tom, semitons, estado.acidente)})` : '';
  if (navigator.share) {
    try {
      await navigator.share({ title: m.titulo, text: `${m.titulo}${tom}`, url });
      return;
    } catch (erro) {
      if (erro?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    avisar('Link copiado');
  } catch {
    window.prompt('Copie o link:', url);
  }
}

// ---------- Rotas: #/ (lista) e #/m/slug?t=2&q=trecho ----------

function lerRota() {
  const [caminho, consulta = ''] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(consulta);
  const m = /^\/m\/([a-z0-9-]+)$/.exec(caminho);
  if (m && porSlug.has(m[1])) {
    const t = params.has('t') ? Number.parseInt(params.get('t'), 10) : undefined;
    abrirMusica(m[1], { semitons: Number.isFinite(t) ? t : undefined, consulta: params.get('q') || '' });
    if (params.has('t') || params.has('q')) history.replaceState(null, '', `#/m/${m[1]}`);
  } else {
    fecharMusica();
  }
}

// ---------- Eventos ----------

function limparBusca() {
  estado.busca = '';
  $('#busca').value = '';
  $('#limpar-busca').hidden = true;
  atualizarModoBusca();
}

document.addEventListener('click', (evento) => {
  const alvo = evento.target;

  const categoria = alvo.closest('[data-categoria]');
  if (categoria) {
    evento.preventDefault();
    if (categoria.closest('#selos')) {
      limparBusca();
      location.hash = '#/';
    }
    escolherCategoria(categoria.dataset.categoria);
    return;
  }

  if (alvo.closest('#limpar-busca')) {
    limparBusca();
    desenharLista();
    $('#busca').focus();
    return;
  }

  if (alvo === $('#opcoes')) {
    fecharOpcoes();
    return;
  }

  if (alvo === $('#dicas')) {
    fecharDicas();
    return;
  }

  const acidente = alvo.closest('[data-acidente]');
  if (acidente) {
    estado.acidente = acidente.dataset.acidente;
    pref.gravar('acidente', estado.acidente);
    desenharOpcoes();
    desenharMusica();
    return;
  }

  // Só os botões: a página inteira também carrega data-tema quando um tema está escolhido.
  const tema = alvo.closest('button[data-tema]');
  if (tema) {
    estado.tema = tema.dataset.tema;
    pref.gravar('tema', estado.tema);
    aplicarTema();
    desenharOpcoes();
    return;
  }

  const botao = alvo.closest('[data-acao]');
  if (!botao) {
    // Toque na cifra (fora de links): fecha o painel aberto ou esconde/mostra a barra.
    if (alvo.closest('#cifra') && !alvo.closest('a, button') && !computador.matches && !deslizou) {
      if (algumPainelAberto()) fecharPaineis();
      else app.classList.toggle('imersivo');
    }
    return;
  }
  switch (botao.dataset.acao) {
    case 'abrir-tom':
      alternarPainel('tom');
      break;
    case 'abrir-letra':
      alternarPainel('letra');
      break;
    case 'fechar-dicas':
      fecharDicas();
      break;
    case 'tom-menos':
      transpor(-1);
      break;
    case 'tom-mais':
      transpor(1);
      break;
    case 'tom-original':
      voltarAoTomOriginal();
      break;
    case 'letra-menor':
      mudarTamanho(-1);
      break;
    case 'letra-maior':
      mudarTamanho(1);
      break;
    case 'rolar':
      if (estado.rolando) pararRolagem();
      else iniciarRolagem();
      break;
    case 'mais-devagar':
      mudarVelocidade(-1);
      break;
    case 'mais-rapido':
      mudarVelocidade(1);
      break;
    case 'mais':
      fecharPaineis();
      if ($('#opcoes').hidden) abrirOpcoes();
      else fecharOpcoes();
      break;
    case 'acordes':
      estado.acordes = !estado.acordes;
      pref.gravar('acordes', estado.acordes);
      desenharOpcoes();
      $('#cifra').classList.toggle('sem-acordes', !estado.acordes);
      acomodarAcordes();
      break;
    case 'colunas':
      estado.colunas = !estado.colunas;
      pref.gravar('colunas', estado.colunas);
      desenharOpcoes();
      $('#cifra').classList.toggle('duas-colunas', estado.colunas && computador.matches);
      acomodarAcordes();
      break;
    case 'inverter': {
      // Troca pelo contrário do que está na tela agora (mesmo quando o tema é automático).
      const escuro = getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)';
      estado.tema = escuro ? 'branco' : 'preto';
      pref.gravar('tema', estado.tema);
      aplicarTema();
      desenharOpcoes();
      break;
    }
    case 'compartilhar':
      fecharOpcoes();
      compartilhar();
      break;
  }
});

const campoBusca = $('#busca');

/** Buscando (campo em foco ou com texto), a capa recolhe: os resultados ficam no topo, acima do teclado. */
function atualizarModoBusca() {
  const painel = $('#painel-lista');
  const buscando = document.activeElement === campoBusca || campoBusca.value.trim() !== '';
  if (painel.classList.contains('buscando') === buscando) return;
  painel.classList.toggle('buscando', buscando);
  if (buscando) {
    if (computador.matches) painel.scrollTop = 0;
    else if (!estado.atual) window.scrollTo(0, 0);
  }
  pintarBarraDoNavegador();
}

campoBusca.addEventListener('focus', atualizarModoBusca);
// Espera o toque terminar: se a capa voltasse na hora, o item tocado mudaria de lugar.
campoBusca.addEventListener('blur', () => setTimeout(atualizarModoBusca, 250));
campoBusca.addEventListener('input', () => {
  estado.busca = campoBusca.value;
  $('#limpar-busca').hidden = !campoBusca.value;
  desenharLista();
  atualizarModoBusca();
});
campoBusca.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter') {
    const primeiro = $('#lista .item');
    if (primeiro) {
      campoBusca.blur();
      location.hash = primeiro.getAttribute('href');
    }
  }
});

document.addEventListener('keydown', (evento) => {
  if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
  const digitando = evento.target.closest?.('input, textarea, [contenteditable="true"]');

  if (evento.key === 'Escape') {
    if (!$('#dicas').hidden) fecharDicas();
    else if (!$('#opcoes').hidden) fecharOpcoes();
    else if (algumPainelAberto()) fecharPaineis();
    else if (digitando && campoBusca.value) {
      limparBusca();
      desenharLista();
    } else if (estado.atual && !computador.matches) location.hash = '#/';
    return;
  }
  if (digitando) return;

  if (evento.key === '/') {
    evento.preventDefault();
    if (estado.atual && !computador.matches) location.hash = '#/';
    campoBusca.focus();
    return;
  }
  if (!estado.atual) return;

  const sobreBotao = evento.target.closest?.('button, a');
  switch (evento.key) {
    case 'ArrowRight':
      irParaVizinha(1);
      break;
    case 'ArrowLeft':
      irParaVizinha(-1);
      break;
    case ']':
      transpor(1);
      break;
    case '[':
      transpor(-1);
      break;
    case '+':
    case '=':
      mudarTamanho(1);
      break;
    case '-':
    case '_':
      mudarTamanho(-1);
      break;
    case ' ':
      if (sobreBotao) return;
      evento.preventDefault();
      if (estado.rolando) pararRolagem();
      else iniciarRolagem();
      break;
    default:
      return;
  }
});

// A barra de cima mostra o título quando ele sai da tela.
new IntersectionObserver(([entrada]) => {
  $('#barra-topo').classList.toggle('rolou', !entrada.isIntersecting && estado.atual !== null);
}).observe($('#titulo'));

// A busca ganha fundo quando gruda no topo (a capa já saiu da tela).
new IntersectionObserver(([entrada]) => {
  $('#procura').classList.toggle('grudou', !entrada.isIntersecting && entrada.boundingClientRect.top < 0);
}).observe($('#sentinela'));

computador.addEventListener('change', () => {
  if (estado.atual) desenharMusica();
  pintarBarraDoNavegador();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintarBarraDoNavegador);

window.addEventListener('hashchange', lerRota);

// ---------- Deslizar para o lado: música seguinte (para a esquerda) ou anterior (para a direita) ----------

let toque = null;
let deslizou = false; // evita que o fim do gesto conte como "toque na cifra"

const painelMusica = $('#musica');
painelMusica.addEventListener(
  'touchstart',
  (evento) => {
    deslizou = false;
    toque = evento.touches.length === 1 ? { x: evento.touches[0].clientX, y: evento.touches[0].clientY, t: Date.now() } : null;
  },
  { passive: true },
);
painelMusica.addEventListener(
  'touchend',
  (evento) => {
    if (!toque || !estado.atual || !$('#opcoes').hidden || !$('#dicas').hidden) return;
    const fim = evento.changedTouches[0];
    const dx = fim.clientX - toque.x;
    const dy = fim.clientY - toque.y;
    const rapido = Date.now() - toque.t < 700;
    toque = null;
    // Só conta se for bem horizontal: rolar a cifra para baixo não troca de música.
    if (!rapido || Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2.5) return;
    deslizou = true;
    irParaVizinha(dx < 0 ? 1 : -1);
  },
  { passive: true },
);

// ---------- Início ----------

aplicarTema();
$('#capa-sub').textContent = `${indice.length} músicas para tocar e cantar com o Alerta.`;
$('#contagem').textContent = `${indice.length} músicas em ${nomesCategorias.length} categorias`;
desenharBlocos();
desenharCategorias();
desenharLista();
lerRota();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
