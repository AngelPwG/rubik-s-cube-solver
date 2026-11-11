/**
 * solver-client.js — Puente entre la interfaz y el Web Worker del solver.
 *
 * La interfaz solo conoce esta clase: pide "resuelve este estado con este
 * algoritmo" y recibe una promesa con el resultado. No le importa si por
 * debajo trabaja el C++ compilado a WebAssembly o el respaldo en JavaScript.
 *
 * Forma del resultado (misma información que SearchResult en search/search.hpp):
 *   {
 *     algorithm:     'bfs' | 'astar',
 *     status:        'solved' | 'limit' | 'exhausted' | 'invalid' | 'cancelled',
 *     moves:         ['R', 'Ui', ...],   // solución en orden de ejecución
 *     expandedNodes: number,
 *     searchTimeMs:  number,
 *     solutionCost:  number,              // número de giros
 *     engine:        'wasm' | 'js',
 *     warning?:      string
 *   }
 */
import { applyMoves, isSolved, MOVES } from './cube-model.js';
import { DEFAULT_LIMITS } from './search-js.js';

export class SolverClient {
  /**
   * @param {(engine: 'wasm' | 'js') => void} onEngineReady
   *        se llama cuando se sabe qué motor de búsqueda quedó activo
   */
  constructor(onEngineReady = () => {}) {
    this.onEngineReady = onEngineReady;
    this.pending = new Map(); // id de petición → función que resuelve su promesa
    this.nextId = 1;
    this.startWorker();
  }

  /** Crea el Web Worker y conecta sus mensajes. */
  startWorker() {
    const workerUrl = new URL('./solver-worker.js', import.meta.url);
    workerUrl.searchParams.set('v', Date.now().toString());
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === 'ready') {
        this.onEngineReady(message.engine);
      } else if (message.type === 'result') {
        const finish = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.result.engine) this.onEngineReady(message.result.engine);
        if (finish) finish(message.result);
      }
    };
    this.worker.onerror = (event) => {
      // Un error inesperado en el worker no debe dejar promesas colgadas.
      this.failAll(`Error en el solver: ${event.message}`);
    };
  }

  /**
   * Resuelve un estado del cubo.
   * @param {'bfs' | 'astar'} algorithm
   * @param {string} key estado de 54 letras
   * @param {{maxExpandedNodes:number, maxTimeMs:number}} limits
   * @returns {Promise<object>} resultado con la forma descrita arriba
   */
  solve(algorithm, key, limits = DEFAULT_LIMITS) {
    return new Promise((resolve) => {
      const id = this.nextId++;
      this.pending.set(id, (result) => resolve(this.validate(key, result)));
      this.worker.postMessage({ id, algorithm, key, limits });
    });
  }

  /**
   * Comprueba la solución antes de mostrarla: se aplica al estado inicial y
   * el cubo debe quedar resuelto. Así un error en cualquier algoritmo se
   * detecta aquí en vez de verse como una animación que "no termina bien".
   */
  validate(startKey, result) {
    if (result.status !== 'solved') return result;
    const unknown = result.moves.find((move) => !MOVES[move]);
    if (unknown) {
      return { ...result, status: 'invalid', warning: `Movimiento desconocido en la solución: ${unknown}` };
    }
    if (!isSolved(applyMoves(startKey, result.moves))) {
      return { ...result, status: 'invalid', warning: 'La secuencia devuelta no deja el cubo resuelto.' };
    }
    return result;
  }

  /** Cancela las búsquedas en curso apagando el worker y creando uno nuevo. */
  cancel() {
    this.worker.terminate();
    this.failAll(null);
    this.startWorker();
  }

  /** Termina todas las peticiones pendientes como canceladas (o con un aviso). */
  failAll(warning) {
    for (const finish of this.pending.values()) {
      finish({
        status: 'cancelled', moves: [], expandedNodes: 0, searchTimeMs: 0, solutionCost: 0,
        ...(warning ? { warning } : {}),
      });
    }
    this.pending.clear();
  }
}
