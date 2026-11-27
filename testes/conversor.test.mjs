import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ajustarPosicoes,
  arrumarLetra,
  arrumarTitulo,
  converterDoc,
  ehLinhaDeAcordes,
  mesclar,
  rotulo,
} from '../scripts/conversor.mjs';

test('coloca o acorde na coluna certa da letra', () => {
  assert.equal(mesclar('G         D', 'Canto a melodia'), '[G]Canto a me[D]lodia');
  // Uma letra depois do começo da palavra é desvio do doc: vai para o começo.
  assert.equal(mesclar('G        D', 'Canto a melodia'), '[G]Canto a [D]melodia');
  assert.equal(mesclar('    C', 'Sol'), 'Sol [C]');
  assert.equal(mesclar('C   ( Am  G )', 'Lá'), '[C]Lá    [(Am]    [G)]');
});

test('separa acordes grudados por falta de espaço', () => {
  assert.equal(mesclar('C#9C#m', 'Luz'), '[C#9]Luz[C#m]');
  assert.equal(mesclar('C#9C#m', 'Luzeiro'), '[C#9]Luz[C#m]eiro');
});

test('corrige o desvio de uma coluna', () => {
  assert.equal(ajustarPosicoes('V[E]em comigo'), '[E]Vem comigo');
  assert.equal(ajustarPosicoes('Minha[Am] voz'), 'Minha [Am]voz');
  assert.equal(ajustarPosicoes('can[C]tar'), 'can[C]tar');
});

test('distingue linha de acordes de letra', () => {
  assert.ok(ehLinhaDeAcordes(' F  C7  C7  F'));
  assert.ok(ehLinhaDeAcordes('Em             A   (Pausa)'));
  assert.ok(ehLinhaDeAcordes('( A   C#m  B )'));
  assert.ok(!ehLinhaDeAcordes('A A A A A A A A A'));
  assert.ok(!ehLinhaDeAcordes('Em quem confiarei'));
  assert.ok(!ehLinhaDeAcordes('E me abandonar'));
});

test('reconhece nomes de seção', () => {
  assert.deepEqual(rotulo('[Refrão]'), { nome: 'Refrão', resto: '' });
  assert.deepEqual(rotulo('[Interlúdio] F  C/E'), { nome: 'Interlúdio', resto: 'F  C/E' });
  assert.deepEqual(rotulo('Refrão: Dm  D9'), { nome: 'Refrão', resto: 'Dm  D9' });
  assert.equal(rotulo('[E]'), null);
  assert.equal(rotulo('Final feliz desta canção'), null);
});

test('arruma título e letra sem mudar o tamanho da linha', () => {
  assert.equal(arrumarTitulo('TU ES O CENTRO'), 'Tu És o Centro');
  assert.equal(arrumarTitulo('CANÇÃO DA ALEGRIA'), 'Canção da Alegria');
  const letra = 'CANTE COM O ESPIRITO SANTO';
  assert.equal(arrumarLetra(letra), 'Cante com o Espírito Santo');
  assert.equal(arrumarLetra(letra).length, letra.length);
  assert.equal(arrumarLetra('louvamos a deus e a jesus'), 'Louvamos a Deus e a Jesus');
});

test('converte o doc inteiro em músicas ChordPro', () => {
  const doc = [
    '![][image1]',
    '**Canção de Teste**',
    '**`G`**        `D`  ',
    '`Canto a melodia`  ',
    '',
    '`[Refrão]`',
    '',
    '    `C`  ',
    '`Sol maior`',
    '`( G  D )`',
    '',
    '**SEGUNDA CANÇÃO**',
    'Am      F\\#m  ',
    'Só letra aqui\\!',
    '',
    '[image1]: <data:image/png;base64,AAAA>',
  ].join('\n');

  const musicas = converterDoc(doc, { 'cancao-de-teste': ['Adoração'] });
  assert.equal(musicas.length, 2);
  assert.equal(musicas[0].slug, 'cancao-de-teste');
  assert.equal(
    musicas[0].cho,
    '{title: Canção de Teste}\n{key: G}\n{categoria: Adoração}\n\n[G]Canto a [D]melodia\n\n{c: Refrão}\nSol [C]maior\n[(G]  [D)]\n',
  );
  assert.equal(musicas[1].titulo, 'Segunda Canção');
  assert.equal(musicas[1].cho, '{title: Segunda Canção}\n{key: Am}\n\n[Am]Só letra [F#m]aqui!\n');
});
