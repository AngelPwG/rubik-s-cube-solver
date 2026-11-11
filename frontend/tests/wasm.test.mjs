import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createModule from '../public/wasm/solver.js';
import { SOLVED_KEY, MOVE_NAMES, applyMoves, isSolved } from '../src/cube-model.js';

const module = await createModule({
  wasmBinary: await readFile(new URL('../public/wasm/solver.wasm', import.meta.url)),
});
const call = (key, algorithm, nodes = 100000, ms = 5000) => JSON.parse(module.ccall(
  'solve_cube', 'string', ['string', 'number', 'number', 'number'], [key, algorithm, nodes, ms],
));
const cases = [[], ...MOVE_NAMES.map(m => [m]), ['R', 'U', 'F'], ['R', 'U', 'F', 'L']];
for (const moves of cases) {
  const start = applyMoves(SOLVED_KEY, moves);
  const result = call(start, 1);
  assert.equal(result.status, 'solved', moves.join(' '));
  const solution = result.moves.trim().split(/\s+/).filter(Boolean);
  assert.ok(isSolved(applyMoves(start, solution)));
  assert.equal(result.solutionCost, solution.length);
  assert.ok(solution.length <= moves.length);
  assert.ok(result.expandedNodes >= 0 && result.searchTimeMs >= 0);
}
const hard = applyMoves(SOLVED_KEY, ['R', 'U', 'F', 'L']);
assert.equal(call(hard, 1, 0).status, 'limit');
assert.equal(call('bad', 1).status, 'error');
assert.equal(call(SOLVED_KEY, 5).status, 'error');
assert.equal(call(SOLVED_KEY, 1, -1).status, 'error');
assert.equal(call(SOLVED_KEY, 1, 10, -1).status, 'error');
const bfs = call(SOLVED_KEY, 0);
if (bfs.status === 'error') {
  assert.match(bfs.message, /BFS.*pendiente/);
  console.log('BFS de C++ pendiente: no se implementa ni se simula en esta entrega.');
} else assert.equal(bfs.status, 'solved');
console.log(`OK: puente real C++/Wasm, ${cases.length} casos A*, repeticion de soluciones y limites.`);
