/**
 * search-js.js — BFS y A* en JavaScript, usados SOLO como respaldo.
 *
 * Los algoritmos oficiales del proyecto son los de C++ (search/bfs.cpp y
 * search/astar.cpp) compilados a WebAssembly. Mientras ese módulo no exista o
 * no exporte solve_cube(), la interfaz usa estas versiones para poder funcionar.
 *
 * Siguen el mismo diseño que la documentación del equipo:
 *   - Cada giro cuesta 1, así que g(n) = número de giros hechos.
 *   - h(n) = ⌈ stickers mal colocados / 20 ⌉  (misma heurística que el A* en C++).
 *   - En A* la meta se revisa al SACAR el nodo de la lista abierta (necesario
 *     para que la solución sea óptima). En BFS se revisa al GENERAR el hijo,
 *     que es la versión clásica de BFS y sigue dando la solución más corta.
 *   - Devuelven la misma información que SearchResult en search/search.hpp.
 *
 * "Nodo expandido" = nodo que se sacó de la frontera y al que se le generaron
 * sus 12 hijos.
 */
import { MOVE_NAMES, PERMUTATIONS, isSolved } from './cube-model.js';

/** Límites por defecto de una búsqueda (mismos campos que SearchLimits en C++). */
export const DEFAULT_LIMITS = { maxExpandedNodes: 1000000, maxTimeMs: 10000 };

/** Cada cuántos nodos expandidos se revisa el reloj (revisarlo siempre es lento). */
const TIME_CHECK_INTERVAL = 512;

/** Permutaciones en el mismo orden que MOVE_NAMES, para recorrerlas rápido. */
const PERMS = MOVE_NAMES.map((name) => PERMUTATIONS[name]);

/** Búfer reutilizable para armar el estado hijo sin crear basura en cada giro. */
const buffer = new Uint8Array(54);

/** Aplica el movimiento número `m` (índice en MOVE_NAMES) a un estado. */
function applyMoveIndex(key, m) {
  const perm = PERMS[m];
  for (let i = 0; i < 54; i++) buffer[i] = key.charCodeAt(perm[i]);
  return String.fromCharCode.apply(null, buffer);
}

/**
 * Heurística h(n): cota inferior de los giros que faltan.
 * Un sticker está mal colocado si su color es distinto al del centro de su cara
 * (los centros nunca se mueven). Un giro mueve como máximo 20 stickers, por lo
 * que hacen falta al menos ⌈mal / 20⌉ giros. Nunca sobreestima (es admisible).
 * @param {string} key estado de 54 letras
 * @returns {number} entre 0 y 3
 */
export function heuristic(key) {
  let wrong = 0;
  for (let face = 0; face < 6; face++) {
    const center = key[face * 9 + 4];
    for (let i = 0; i < 9; i++) {
      if (key[face * 9 + i] !== center) wrong++;
    }
  }
  return Math.floor((wrong + 19) / 20);
}

/**
 * Reconstruye el camino desde el nodo meta hasta el inicial siguiendo los
 * padres (rastreo inverso) y lo devuelve en orden de ejecución.
 * @param {number} goal      índice del nodo meta
 * @param {number[]} parent  parent[i] = índice del padre de i (-1 en el inicial)
 * @param {number[]} moveOf  moveOf[i] = movimiento que generó al nodo i
 * @returns {string[]} nombres de los movimientos
 */
function reconstructPath(goal, parent, moveOf) {
  const path = [];
  for (let i = goal; parent[i] !== -1; i = parent[i]) path.push(MOVE_NAMES[moveOf[i]]);
  return path.reverse();
}

/** Arma el objeto de resultado común a los dos algoritmos. */
function makeResult(status, moves, expandedNodes, startTime) {
  return {
    status, // 'solved' | 'limit' | 'exhausted'
    moves,
    expandedNodes,
    searchTimeMs: performance.now() - startTime,
    solutionCost: moves.length,
  };
}

/**
 * Búsqueda en anchura (BFS): búsqueda ciega que explora por niveles.
 * Usa una cola FIFO: primero todos los estados a 1 giro, luego a 2, etc.
 * Por eso el primer estado resuelto que aparece es el de menor número de giros.
 * @param {string} startKey estado inicial (54 letras)
 * @param {{maxExpandedNodes:number, maxTimeMs:number}} limits
 */
export function solveBFS(startKey, limits = DEFAULT_LIMITS) {
  const startTime = performance.now();
  if (isSolved(startKey)) return makeResult('solved', [], 0, startTime);

  // Los nodos viven en arreglos paralelos; el índice identifica al nodo.
  const keys = [startKey];   // estado de cada nodo (también funciona como la cola)
  const parent = [-1];       // índice del padre
  const moveOf = [0];        // movimiento que lo generó
  const visited = new Set([startKey]); // estados ya descubiertos (tabla hash)
  let head = 0;              // posición del frente de la cola
  let expanded = 0;

  while (head < keys.length) {
    if (expanded >= limits.maxExpandedNodes ||
        (expanded % TIME_CHECK_INTERVAL === 0 &&
         performance.now() - startTime > limits.maxTimeMs)) {
      return makeResult('limit', [], expanded, startTime);
    }

    const current = head++;  // sacar el nodo más antiguo de la cola
    const key = keys[current];
    expanded++;

    for (let m = 0; m < 12; m++) {
      const next = applyMoveIndex(key, m);
      if (visited.has(next)) continue; // ya se llegó a este estado por otro camino
      visited.add(next);
      keys.push(next);
      parent.push(current);
      moveOf.push(m);
      if (isSolved(next)) {
        const goal = keys.length - 1;
        return makeResult('solved', reconstructPath(goal, parent, moveOf), expanded, startTime);
      }
    }
  }

  return makeResult('exhausted', [], expanded, startTime);
}

/**
 * Montículo binario mínimo para la lista abierta de A*.
 * Guarda índices de nodos y los ordena por f; si dos nodos empatan en f,
 * sale primero el que se insertó antes (así el resultado es reproducible).
 */
class MinHeap {
  constructor(fOf) {
    this.items = [];
    this.fOf = fOf; // arreglo con el valor f de cada nodo
  }

  get size() { return this.items.length; }

  /** true si el nodo a debe salir antes que el nodo b. */
  before(a, b) {
    return this.fOf[a] < this.fOf[b] || (this.fOf[a] === this.fOf[b] && a < b);
  }

  push(node) {
    const items = this.items;
    let i = items.length;
    items.push(node);
    while (i > 0) { // sube el nodo mientras sea mejor que su padre
      const up = (i - 1) >> 1;
      if (!this.before(items[i], items[up])) break;
      [items[i], items[up]] = [items[up], items[i]];
      i = up;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) { // baja el nodo mientras alguno de sus hijos sea mejor
        const l = 2 * i + 1;
        const r = l + 1;
        let best = i;
        if (l < items.length && this.before(items[l], items[best])) best = l;
        if (r < items.length && this.before(items[r], items[best])) best = r;
        if (best === i) break;
        [items[i], items[best]] = [items[best], items[i]];
        i = best;
      }
    }
    return top;
  }
}

/**
 * Búsqueda A*: búsqueda informada que expande primero el nodo con menor
 * f(n) = g(n) + h(n). Con una heurística admisible, el primer estado resuelto
 * que sale de la lista abierta corresponde a la solución más corta.
 * @param {string} startKey estado inicial (54 letras)
 * @param {{maxExpandedNodes:number, maxTimeMs:number}} limits
 */
export function solveAStar(startKey, limits = DEFAULT_LIMITS) {
  const startTime = performance.now();

  const keys = [startKey];           // estado de cada nodo creado
  const g = [0];                     // costo real acumulado
  const f = [heuristic(startKey)];   // g + h, prioridad en la lista abierta
  const parent = [-1];
  const moveOf = [0];
  const open = new MinHeap(f);       // lista abierta (cola de prioridad)
  const closed = new Set();          // estados ya expandidos (tabla hash)
  let expanded = 0;
  let stoppedByLimit = false;

  open.push(0);
  while (open.size > 0) {
    const current = open.pop();
    const key = keys[current];

    // La lista abierta puede tener el mismo estado repetido; se descarta aquí.
    if (closed.has(key)) continue;
    closed.add(key);

    if (isSolved(key)) {
      return makeResult('solved', reconstructPath(current, parent, moveOf), expanded, startTime);
    }
    if (expanded >= limits.maxExpandedNodes ||
        (expanded % TIME_CHECK_INTERVAL === 0 &&
         performance.now() - startTime > limits.maxTimeMs)) {
      stoppedByLimit = true;
      break;
    }

    expanded++;
    const childG = g[current] + 1;
    for (let m = 0; m < 12; m++) {
      const next = applyMoveIndex(key, m);
      if (closed.has(next)) continue;
      keys.push(next);
      g.push(childG);
      f.push(childG + heuristic(next));
      parent.push(current);
      moveOf.push(m);
      open.push(keys.length - 1);
    }
  }

  return makeResult(stoppedByLimit ? 'limit' : 'exhausted', [], expanded, startTime);
}

/** Ejecuta el algoritmo pedido: 'bfs' o 'astar'. */
export function solveWithJs(algorithm, startKey, limits = DEFAULT_LIMITS) {
  if (algorithm === 'bfs') return solveBFS(startKey, limits);
  if (algorithm === 'astar') return solveAStar(startKey, limits);
  throw new Error(`Algoritmo desconocido: ${algorithm}`);
}
