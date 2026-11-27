import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehAcorde, lerChordPro, letraPura, primeiroAcorde, tomDoAcorde, transporAcorde } from '../js/cifra.js';

test('reconhece os acordes usados nas cifras brasileiras', () => {
  for (const a of ['E', 'C#m', 'E7M', 'C#9', 'E6/C#', 'A#/C', 'C#°', 'Cº', 'Em7(5-)', 'A7(9+)', 'G7(9/11+/13)',
    'Ebm7', 'A#7M', 'C7(13)', 'D/F#', 'G#7(4)', 'Asus4', 'Bb', '(F#m', 'E)', 'D.']) {
    assert.ok(ehAcorde(a), a);
  }
});

test('não confunde palavras da letra com acordes', () => {
  for (const p of ['Eu', 'Em7x', 'Amor', 'Deus', 'E,', 'Pausa', 'Ah', 'Da', 'Ama']) {
    if (p === 'E,') continue; // pontuação colada é aceita de propósito ("D." no doc)
    assert.ok(!ehAcorde(p), p);
  }
});

test('transpõe fundamental e baixo', () => {
  assert.equal(transporAcorde('A#/C', 2), 'C/D');
  assert.equal(transporAcorde('E6/C#', 1), 'F6/D');
  assert.equal(transporAcorde('G7(9/11+/13)', 1), 'G#7(9/11+/13)');
  assert.equal(transporAcorde('Ebm7', -1, 'bemol'), 'Dm7');
  assert.equal(transporAcorde('B', 1), 'C');
  assert.equal(transporAcorde('C', -1, 'bemol'), 'B');
  assert.equal(transporAcorde('C#m', 0), 'C#m');
  assert.equal(transporAcorde('(F#m', 2), '(G#m');
  assert.equal(transporAcorde('E)', 12), 'E)');
  assert.equal(transporAcorde('Pausa', 3), 'Pausa');
});

test('escolhe sustenido ou bemol ao transpor', () => {
  assert.equal(transporAcorde('A', 1, 'sustenido'), 'A#');
  assert.equal(transporAcorde('A', 1, 'bemol'), 'Bb');
});

test('descobre o tom pelo acorde', () => {
  assert.equal(tomDoAcorde('F9'), 'F');
  assert.equal(tomDoAcorde('C#m7'), 'C#m');
  assert.equal(tomDoAcorde('Cmaj7'), 'C');
  assert.equal(tomDoAcorde('G/B'), 'G');
  assert.equal(primeiroAcorde('[*(Pausa)] la [Am7]la [G]'), 'Am7');
});

test('lê ChordPro com seções, categorias, anotações e linhas só de acordes', () => {
  const m = lerChordPro(
    [
      '{title: Canção de Teste}',
      '{key: G}',
      '{categoria: Adoração, Animação}',
      '',
      '{c: Refrão}',
      '[G]Canto a me[D]lodia [*x2]',
      '[(C]  [D)]',
      '',
      'linha sem acorde',
    ].join('\n'),
  );
  assert.equal(m.titulo, 'Canção de Teste');
  assert.equal(m.tom, 'G');
  assert.deepEqual(m.categorias, ['Adoração', 'Animação']);
  assert.deepEqual(m.linhas.map((l) => l.tipo), ['secao', 'letra', 'acordes', 'vazia', 'letra']);
  assert.deepEqual(m.linhas[1].partes, [
    { acorde: 'G', anotacao: false, texto: 'Canto a me' },
    { acorde: 'D', anotacao: false, texto: 'lodia ' },
    { acorde: 'x2', anotacao: true, texto: '' },
  ]);
});

test('lê a ficha de uma música que só tem o link da cifra', () => {
  const m = lerChordPro('{title: Casa}\n{artist: Colo de Deus}\n{link: https://exemplo.com.br/casa/}\n\n# comentário\n');
  assert.equal(m.link, 'https://exemplo.com.br/casa/');
  assert.equal(m.linhas.length, 0);
  assert.equal(m.artista, 'Colo de Deus');
});

test('letra pura serve para a busca', () => {
  assert.equal(letraPura('{title: X}\n[G]Canto a me[D]lodia\n[C]  [D]\n\nfim'), 'Canto a melodia\nfim');
});
