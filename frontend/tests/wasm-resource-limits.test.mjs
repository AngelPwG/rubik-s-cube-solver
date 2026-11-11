import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import createModule from '../public/wasm/solver.js';
import {SOLVED_KEY,applyMoves,isSolved} from '../src/cube-model.js';
const module=await createModule({wasmBinary:await readFile(new URL('../public/wasm/solver.wasm', import.meta.url))});
const run=(moves,algorithm,nodes=1000000,time=10000)=>JSON.parse(module.ccall('solve_cube','string',['string','number','number','number'],[applyMoves(SOLVED_KEY,moves),algorithm,nodes,time]));
for(const algorithm of [0,1]){
 const solved=run(['R','U','F','L','D'],algorithm);assert.equal(solved.status,'solved');
 assert.ok(isSolved(applyMoves(applyMoves(SOLVED_KEY,['R','U','F','L','D']),solved.moves.split(' '))));
 console.log(algorithm===0?'BFS 5':'A* 5',JSON.stringify(solved));
 const nodeLimit=run(['R','U','F','L','D'],algorithm,3);assert.equal(nodeLimit.limitReason,'nodes');
 const timeLimit=run(['R','U','F','L','D'],algorithm,1000000,0);assert.equal(timeLimit.limitReason,'time');
}
const hard=run(['R','U','Li','Fi','B','Li','F'],0);
assert.equal(hard.status,'limit');assert.equal(hard.limitReason,'states');assert.equal(hard.storedStates,1000000);
console.log('BFS 7',JSON.stringify(hard),'RSS MiB',Math.round(process.memoryUsage().rss/1048576));
const a=run(['R','U','Li','Fi','B','Li','F'],1);assert.equal(a.status,'solved');console.log('A* 7',JSON.stringify(a));
console.log('OK Wasm: cinco giros, límites reales, corte por estados y siguiente algoritmo en el mismo módulo.');
