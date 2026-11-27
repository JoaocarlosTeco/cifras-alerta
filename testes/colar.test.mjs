import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acharFicha, converterColado, separarColados } from '../scripts/colar.mjs';

test('separa várias cifras coladas num arquivo só e acha a ficha de cada uma', () => {
  const texto = 'Canção UmGrupo A\n\nTom:  G\n\nG   D\nLá lá\n\nCanção UmOutra Cantora\n\nTom: A\n\nA\nLé lé\n';
  const blocos = separarColados(texto);
  assert.deepEqual(blocos.map((b) => b.cabecalho), ['Canção UmGrupo A', 'Canção UmOutra Cantora']);
  assert.match(blocos[0].texto, /Tom:  G/);
  const fichas = [
    { slug: 'cancao-um', titulo: 'Canção Um', artista: 'Grupo A' },
    { slug: 'cancao-um-2', titulo: 'Canção Um', artista: 'Outra Cantora' },
  ];
  assert.equal(acharFicha(blocos[0].cabecalho, fichas).slug, 'cancao-um');
  assert.equal(acharFicha(blocos[1].cabecalho, fichas).slug, 'cancao-um-2');
  assert.equal(acharFicha('Desconhecida', fichas), null);
  assert.deepEqual(separarColados('G  D\nsó uma cifra, sem cabeçalho\n'), []);
});

test('cifra colada entra na ficha que já existe, mantendo artista e categoria', () => {
  const ficha = { titulo: 'Canção de Teste', artista: 'Grupo Exemplo', categorias: ['Adoração'], linhas: [] };
  const colado = 'Tom: D\n\n[Intro] D  A\n\nD         A\nCanto a melodia\n';
  const { cho } = converterColado(colado, ficha, 'cancao-de-teste');
  assert.equal(
    cho,
    '{title: Canção de Teste}\n{artist: Grupo Exemplo}\n{key: D}\n{categoria: Adoração}\n\n{c: Intro}\n[D]  [A]\n\n[D]Canto a me[A]lodia\n',
  );
});

test('música nova usa a primeira linha como título e o primeiro acorde como tom', () => {
  const { titulo, cho } = converterColado('OUTRA CANÇÃO\n\nEm      C\nSol e lua\n', null, 'outra-cancao');
  assert.equal(titulo, 'Outra Canção');
  assert.equal(cho, '{title: Outra Canção}\n{key: Em}\n\n[Em]Sol e lu[C]a\n');
});
