/**
 * Prueba de paridad: el modelo del cubo en JavaScript debe dar exactamente
 * los mismos estados que el C++ de cube/ (fixtures.json se generó con ese C++).
 *
 * Ejecutar desde la raíz del repo:   node frontend/tests/model.test.mjs
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  SOLVED_KEY, MOVE_NAMES, applyMove, applyMoves, inverseMove, isSolved, randomScramble, MOVES,
} from '../src/cube-model.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url)));

// 1. El estado resuelto coincide con createSolvedCube().
assert.equal(SOLVED_KEY, fixtures.solved);
assert.equal(isSolved(SOLVED_KEY), true);

// 2. Cada uno de los 12 giros da el mismo resultado que applyMove() en C++.
for (const move of MOVE_NAMES) {
  assert.equal(applyMove(SOLVED_KEY, move), fixtures.singleMoves[move], `giro ${move}`);
}

// 3. 200 secuencias aleatorias de hasta 30 giros coinciden con el C++.
for (const { moves, key } of fixtures.sequences) {
  assert.equal(applyMoves(SOLVED_KEY, moves.split(' ')), key, `secuencia ${moves}`);
}

// 4. Propiedades básicas: giro + inverso = nada; el mismo giro 4 veces = nada.
const scrambled = applyMoves(SOLVED_KEY, ['R', 'U', 'F', 'Li', 'D', 'Bi']);
for (const move of MOVE_NAMES) {
  assert.equal(applyMove(applyMove(scrambled, move), inverseMove(move)), scrambled);
  assert.equal(applyMoves(scrambled, [move, move, move, move]), scrambled);
  assert.equal(isSolved(applyMove(SOLVED_KEY, move)), false);
}

// 5. La mezcla aleatoria tiene el largo pedido y no repite cara consecutiva.
for (let trial = 0; trial < 400; trial++) {
  const n = 1 + (trial % 8);
  const s = randomScramble(n);
  assert.equal(s.length, n);
  for (let i = 1; i < s.length; i++) assert.notEqual(MOVES[s[i]].face, MOVES[s[i - 1]].face);
  for (let i = 2; i < s.length; i++) {
    const sameAxis = MOVES[s[i]].axis === MOVES[s[i - 1]].axis;
    assert.ok(!(sameAxis && MOVES[s[i]].face === MOVES[s[i - 2]].face), `mezcla con giros que se cancelan: ${s}`);
  }
}

console.log(`OK: 12 giros y ${fixtures.sequences.length} secuencias coinciden con el C++.`);
