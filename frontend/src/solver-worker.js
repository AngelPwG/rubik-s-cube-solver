/**
 * solver-worker.js — Web Worker que ejecuta las búsquedas.
 *
 * Una búsqueda puede tardar varios segundos. Si corriera en el hilo principal,
 * la página se congelaría (no se podría girar el cubo ni cancelar). Por eso
 * corre aquí, en un hilo aparte, y se comunica con la página por mensajes.
 *
 * Motor de búsqueda:
 *   1. Intenta cargar el módulo WebAssembly generado por scripts/build-wasm.sh
 *      (frontend/public/wasm/solver.js) y usar su función solve_cube().
 *   2. Si el módulo no existe o todavía no exporta solve_cube(), usa el BFS y
 *      A* de respaldo escritos en JavaScript (search-js.js).
 *
 * Mensajes que recibe:  { id, algorithm: 'bfs' | 'astar', key, limits }
 * Mensajes que envía:   { type: 'ready', engine }
 *                       { type: 'result', id, result }
 */
import { solveWithJs } from './search-js.js?v=resources-1';

/** Código numérico de cada algoritmo en la función C++ solve_cube(). */
const ALGORITHM_CODE = { bfs: 0, astar: 1 };

/** Módulo de Emscripten ya inicializado, o null si se usa el respaldo en JS. */
let wasmModule = null;
let needsWasmReload = false;

/**
 * Intenta cargar el solver en WebAssembly.
 * @returns {Promise<'wasm' | 'js'>} el motor que quedó activo
 */
async function loadEngine() {
  try {
    // Cargar el JS y el Wasm con una URL nueva en cada inicio del worker.
    // Evita combinar archivos antiguos de la cache con otra compilacion.
    const version = Date.now().toString();
    const directory = new URL('../public/wasm/', import.meta.url);
    const entry = new URL('solver.js', directory);
    entry.searchParams.set('v', version);
    const { default: createModule } = await import(entry.href);
    const module = await createModule({
      locateFile(file) {
        const url = new URL(file, directory);
        url.searchParams.set('v', version);
        return url.href;
      },
    });
    if (typeof module._solve_cube !== 'function') {
      throw new Error('El modulo WebAssembly no exporta solve_cube');
    }
    wasmModule = module;
    return 'wasm';
  } catch (error) {
    console.error('No se pudo cargar el motor C++/WebAssembly:', error);
    return 'js';
  }
}

/**
 * Llama al solver de C++ y convierte su respuesta al formato de la interfaz.
 * Contrato (ver docs/frontend-contract.md):
 *   const char* solve_cube(const char* stateKey, int algorithm,
 *                          int maxExpandedNodes, double maxTimeMs);
 * Devuelve un JSON: {"status","moves","expandedNodes","searchTimeMs","solutionCost"}
 */
function solveWithWasm(algorithm, key, limits) {
  const json = wasmModule.ccall(
    'solve_cube',
    'string',
    ['string', 'number', 'number', 'number'],
    [key, ALGORITHM_CODE[algorithm], limits.maxExpandedNodes, limits.maxTimeMs],
  );
  const raw = JSON.parse(json);
  if (raw.status === 'error') throw new Error(raw.message || 'solve_cube devolvió un error');
  const moves = raw.moves ? raw.moves.trim().split(/\s+/).filter(Boolean) : [];
  return {
    status: raw.status,
    moves,
    expandedNodes: Number(raw.expandedNodes),
    searchTimeMs: Number(raw.searchTimeMs),
    solutionCost: Number(raw.solutionCost ?? moves.length),
    storedStates: Number(raw.storedStates ?? 0),
    limitReason: raw.limitReason ?? '',
    ...(raw.limitReason === 'states' ? {
      warning: `Se alcanzó el límite de ${Number(raw.maxStoredStates).toLocaleString('es-MX')} estados almacenados. La búsqueda se detuvo en C++/WebAssembly para acotar el consumo de memoria.`,
    } : {}),
  };
}

function wasmFailure(error) {
  return {
    status: 'error', engine: 'wasm', moves: [], solutionCost: null,
    expandedNodes: null, searchTimeMs: null,
    warning: `La ejecución C++/WebAssembly falló (${error.message}). No se repitió la búsqueda en JavaScript; no hay métricas válidas para esta ejecución.`,
  };
}

const enginePromise = loadEngine().then((engine) => {
  self.postMessage({ type: 'ready', engine });
  return engine;
});

self.onmessage = async (event) => {
  const { id, algorithm, key, limits } = event.data;
  await enginePromise;

  let result;
  if (needsWasmReload) {
    // A module that aborted must not be reused by the next algorithm.
    wasmModule = null;
    await loadEngine();
    needsWasmReload = false;
    if (!wasmModule) {
      result = wasmFailure(new Error('No se pudo reiniciar el módulo'));
      self.postMessage({ type: 'result', id, result: { ...result, algorithm } });
      return;
    }
  }
  if (wasmModule) {
    try {
      result = { ...solveWithWasm(algorithm, key, limits), engine: 'wasm' };
    } catch (error) {
      console.error('La búsqueda C++/WebAssembly falló:', error);
      needsWasmReload = true;
      result = wasmFailure(error);
    }
  } else {
    result = { ...solveWithJs(algorithm, key, limits), engine: 'js' };
  }

  self.postMessage({ type: 'result', id, result: { ...result, algorithm } });
};
