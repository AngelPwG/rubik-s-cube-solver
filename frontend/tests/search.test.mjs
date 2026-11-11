/**
 * Prueba del BFS y A* de respaldo en JavaScript.
 * Ejecutar desde la raíz del repo:   node frontend/tests/search.test.mjs
 */
import assert from 'node:assert/strict';
import { SOLVED_KEY, applyMoves, isSolved, randomScramble, formatMoves } from '../src/cube-model.js';
import { solveBFS, solveAStar, heuristic } from '../src/search-js.js';

// Generador pseudoaleatorio con semilla fija para que la prueba sea repetible.
let seed = 12345;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

assert.equal(heuristic(SOLVED_KEY), 0);
assert.deepEqual(solveBFS(SOLVED_KEY).moves, []);
assert.equal(solveAStar(SOLVED_KEY).expandedNodes, 0);

const limits = { maxExpandedNodes: 150_000, maxTimeMs: 60_000 };
for (let depth = 1; depth <= 6; depth++) {
  for (let t = 0; t < (depth <= 4 ? 3 : 2); t++) {
    const scramble = randomScramble(depth, random);
    const start = applyMoves(SOLVED_KEY, scramble);
    const bfs = solveBFS(start, limits);
    const astar = solveAStar(start, limits);
    for (const [name, res] of [['BFS', bfs], ['A*', astar]]) {
      assert.equal(res.status, 'solved', `${name} no resolvió ${scramble}`);
      assert.ok(isSolved(applyMoves(start, res.moves)), `${name} devolvió una solución inválida`);
      assert.ok(res.moves.length <= depth, `${name} dio una solución más larga que la mezcla`);
    }
    // Los dos son óptimos, así que deben encontrar soluciones del mismo largo.
    assert.equal(bfs.moves.length, astar.moves.length);
    console.log(
      `mezcla ${depth}: ${formatMoves(scramble).padEnd(18)} | BFS ${String(bfs.expandedNodes).padStart(7)} nodos ` +
      `${bfs.searchTimeMs.toFixed(0).padStart(5)} ms | A* ${String(astar.expandedNodes).padStart(7)} nodos ` +
      `${astar.searchTimeMs.toFixed(0).padStart(5)} ms | solución ${bfs.moves.length}`,
    );
  }
}

// El límite de nodos se respeta y se reporta como 'limit'.
const hard = applyMoves(SOLVED_KEY, randomScramble(12, random));
const limited = solveBFS(hard, { maxExpandedNodes: 1000, maxTimeMs: 60_000 });
assert.equal(limited.status, 'limit');
assert.equal(limited.expandedNodes, 1000);
console.log('OK: BFS y A* de respaldo resuelven y coinciden en el largo de la solución.');
