/**
 * main.js — Punto de entrada de la interfaz.
 *
 * Conecta las tres piezas del frontend:
 *   - el modelo del cubo (cube-model.js): estado y giros,
 *   - las vistas (cube-view.js en 3D y cube-net.js en 2D),
 *   - el cliente del solver (solver-client.js): BFS y A*.
 *
 * Flujo normal de uso:
 *   1. Mezclar el cubo (o girarlo a mano).
 *   2. Resolver con BFS, con A*, o con los dos para compararlos.
 *   3. Reproducir la solución paso a paso y leer las métricas.
 */
import {
  SOLVED_KEY, FACES, MOVES, MOVE_NAMES, COLORS,
  applyMove, applyMoves, inverseMove, isSolved, randomScramble, formatMoves,
} from './cube-model.js';
import { CubeView } from './cube-view.js';
import { CubeNet } from './cube-net.js';
import { SolverClient } from './solver-client.js';
import { DEFAULT_LIMITS } from './search-js.js';

const ALGORITHM_NAME = { bfs: 'BFS', astar: 'A*' };
const STATUS_TEXT = {
  solved: 'Resuelto',
  limit: 'Límite alcanzado',
  exhausted: 'Sin solución',
  invalid: 'Solución inválida',
  cancelled: 'Cancelado',
};
const SCRAMBLE_TURN_MS = 160; // duración de cada giro al mezclar
const MANUAL_TURN_MS = 260;   // duración de un giro hecho a mano
const numberFormat = new Intl.NumberFormat('es-MX');

/** Atajo para obtener un elemento por su id. */
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* Estado de la aplicación                                             */
/* ------------------------------------------------------------------ */

const state = {
  key: SOLVED_KEY,     // estado del cubo que se está mostrando
  history: [],         // giros aplicados desde el último reinicio (la "mezcla")
  problemKey: null,    // estado desde el que se calcularon los resultados
  results: { bfs: null, astar: null },
  running: null,       // algoritmo que se está ejecutando, o null
  solution: null,      // { algorithm, startKey, moves, step } o null
  animating: false,    // true mientras el cubo se está moviendo
  playing: false,      // true mientras la solución se reproduce sola
};

/** Si el usuario pidió menos movimiento en su sistema, no se animan los giros. */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------------ */
/* Vistas                                                              */
/* ------------------------------------------------------------------ */

const net = new CubeNet($('cube-net'));
let view = null;
try {
  view = new CubeView($('cube-view'));
} catch (error) {
  // Sin WebGL no hay vista 3D, pero el mapa 2D y todo lo demás sigue funcionando.
  $('cube-view').classList.add('no-webgl');
  $('cube-view').textContent =
    'Este navegador no pudo iniciar la vista 3D (WebGL). El mapa del cubo de abajo muestra el mismo estado.';
  $('reset-camera').hidden = true;
  console.error(error);
}

/** Pinta el estado actual en las dos vistas, sin animación. */
function showState() {
  view?.setState(state.key);
  net.setState(state.key);
}

/**
 * Aplica un giro al estado y lo anima en la vista 3D.
 * @param {string} move
 * @param {number} durationMs
 */
async function turn(move, durationMs) {
  state.key = applyMove(state.key, move);
  const duration = reducedMotion.matches ? 0 : durationMs;
  if (view) await view.animateMove(move, state.key, duration);
  net.setState(state.key);
}

/** Ejecuta una acción que mueve el cubo, bloqueando los controles mientras dura. */
async function withAnimation(action) {
  if (state.animating) return;
  state.animating = true;
  render();
  try {
    await action();
  } finally {
    state.animating = false;
    render();
  }
}

/* ------------------------------------------------------------------ */
/* Mezclar, reiniciar y girar a mano                                   */
/* ------------------------------------------------------------------ */

/**
 * Si la solución se reprodujo a medias, esos giros ya forman parte de cómo se
 * llegó al estado actual: se agregan al historial para que el texto de la
 * mezcla siga describiendo correctamente el cubo que se ve.
 */
function commitPlayback() {
  const solution = state.solution;
  if (solution) state.history.push(...solution.moves.slice(0, solution.step));
  if (isSolved(state.key)) state.history = []; // un cubo resuelto no tiene mezcla que describir
}

/** Olvida la solución y los resultados: se usa cuando el problema cambia. */
function clearProblem() {
  commitPlayback();
  state.playing = false;
  state.solution = null;
  state.problemKey = null;
  state.results = { bfs: null, astar: null };
  setStatus('');
}

/** Regresa el cubo al estado resuelto. */
function resetCube() {
  clearProblem();
  state.key = SOLVED_KEY;
  state.history = [];
  showState();
  render();
}

/** Parte del cubo resuelto y aplica una mezcla aleatoria del largo elegido. */
function scrambleCube() {
  const length = Number($('scramble-length').value);
  const moves = randomScramble(length);
  resetCube();
  return withAnimation(async () => {
    for (const move of moves) {
      state.history.push(move);
      await turn(move, SCRAMBLE_TURN_MS);
      renderScramble();
    }
  });
}

/** Gira una cara a petición del usuario. */
function manualTurn(move) {
  if (state.animating || state.running) return;
  clearProblem();
  state.history.push(move);
  return withAnimation(() => turn(move, MANUAL_TURN_MS));
}

/* ------------------------------------------------------------------ */
/* Resolver                                                            */
/* ------------------------------------------------------------------ */

const solver = new SolverClient((engine) => {
  $('engine').textContent = engine === 'wasm'
    ? 'Motor: C++ compilado a WebAssembly'
    : 'Motor: JavaScript de respaldo';
  $('engine').dataset.engine = engine;
});

/**
 * Ejecuta uno o varios algoritmos sobre el estado que se está mostrando.
 * @param {('bfs' | 'astar')[]} algorithms
 */
async function solve(algorithms) {
  if (state.running || state.animating) return;
  state.playing = false;

  // Si el cubo cambió desde la última búsqueda, es un problema nuevo.
  if (state.problemKey !== state.key) {
    clearProblem();
    state.problemKey = state.key;
  }
  const startKey = state.problemKey;

  for (const algorithm of algorithms) {
    state.running = algorithm;
    state.results[algorithm] = null;
    setStatus(`Buscando con ${ALGORITHM_NAME[algorithm]}…`);
    render();

    const result = await solver.solve(algorithm, startKey, DEFAULT_LIMITS);
    state.results[algorithm] = { ...result, algorithm };
    if (result.status === 'cancelled') break;
  }
  state.running = null;

  // Cargar en el reproductor la última solución encontrada.
  const solved = [...algorithms].reverse().find((a) => state.results[a]?.status === 'solved');
  if (solved) loadSolution(solved);
  setStatus(describeOutcome(algorithms));
  render();
}

/** Texto que resume cómo terminó la búsqueda más reciente. */
function describeOutcome(algorithms) {
  // Al comparar, el detalle está en la tabla; aquí basta un aviso corto.
  const allSolved = algorithms.every((a) => state.results[a]?.status === 'solved' && !state.results[a].warning);
  if (algorithms.length > 1 && allSolved && state.results[algorithms[0]].moves.length > 0) {
    return 'BFS y A* terminaron; compara los resultados abajo.';
  }
  const messages = algorithms.map((algorithm) => {
    const result = state.results[algorithm];
    if (!result) return null;
    const name = ALGORITHM_NAME[algorithm];
    if (result.warning) return `${name}: ${result.warning}`;
    switch (result.status) {
      case 'solved':
        return result.moves.length === 0
          ? 'El cubo ya está resuelto: no hace falta ningún giro.'
          : `${name} encontró una solución de ${result.moves.length} ${plural(result.moves.length, 'giro', 'giros')}.`;
      case 'limit':
        return `${name} llegó al límite de búsqueda sin encontrar solución. Prueba con una mezcla más corta.`;
      case 'exhausted':
        return `${name} revisó todos los estados alcanzables y no encontró solución.`;
      case 'cancelled':
        return 'Búsqueda cancelada.';
      default:
        return `${name} devolvió una solución que no resuelve el cubo.`;
    }
  });
  return [...new Set(messages.filter(Boolean))].join(' ');
}

/** Pone en el reproductor la solución de un algoritmo, colocada en el paso 0. */
function loadSolution(algorithm) {
  const result = state.results[algorithm];
  state.playing = false;
  state.solution = { algorithm, startKey: state.problemKey, moves: result.moves, step: 0 };
  state.key = state.problemKey;
  showState();
}

/* ------------------------------------------------------------------ */
/* Reproducción paso a paso                                            */
/* ------------------------------------------------------------------ */

/** Duración de cada giro según la velocidad elegida. */
const stepDuration = () => Number($('speed').value);

/** Avanza un giro de la solución. */
function stepForward() {
  const solution = state.solution;
  if (!solution || solution.step >= solution.moves.length) return Promise.resolve();
  return withAnimation(async () => {
    await turn(solution.moves[solution.step], stepDuration());
    solution.step++;
  });
}

/** Deshace el último giro de la solución aplicando su inverso. */
function stepBackward() {
  const solution = state.solution;
  if (!solution || solution.step === 0) return Promise.resolve();
  state.playing = false;
  return withAnimation(async () => {
    await turn(inverseMove(solution.moves[solution.step - 1]), stepDuration());
    solution.step--;
  });
}

/** Salta directo a un paso de la solución, sin animación. */
function jumpToStep(step) {
  const solution = state.solution;
  if (!solution || state.animating) return;
  state.playing = false;
  solution.step = step;
  state.key = applyMoves(solution.startKey, solution.moves.slice(0, step));
  showState();
  render();
}

/** Reproduce la solución completa; si ya iba a la mitad, continúa desde ahí. */
async function togglePlay() {
  const solution = state.solution;
  if (!solution) return;
  if (state.playing) { // el botón funciona como pausa
    state.playing = false;
    render();
    return;
  }
  if (solution.step >= solution.moves.length) jumpToStep(0); // volver a empezar
  state.playing = true;
  while (state.playing && state.solution === solution && solution.step < solution.moves.length) {
    await stepForward();
    if (reducedMotion.matches) await new Promise((r) => setTimeout(r, stepDuration()));
  }
  state.playing = false;
  render();
}

/* ------------------------------------------------------------------ */
/* Dibujo de la interfaz                                               */
/* ------------------------------------------------------------------ */

const plural = (n, one, many) => (n === 1 ? one : many);

/** Da formato a un tiempo en milisegundos. */
function formatTime(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 10) return `${Math.round(ms)} ms`;
  return `${ms.toFixed(1)} ms`;
}

function setStatus(text) {
  $('status').textContent = text;
}

/** Texto con la mezcla aplicada, encima del cubo. */
function renderScramble() {
  const count = state.history.length;
  $('scramble').textContent = count === 0
    ? (isSolved(state.key) ? 'Cubo resuelto' : '')
    : `Mezcla de ${count} ${plural(count, 'giro', 'giros')}: ${formatMoves(state.history)}`;
}

/** Tabla de resultados y frase de comparación. */
function renderResults() {
  for (const algorithm of ['bfs', 'astar']) {
    const row = $(`result-${algorithm}`);
    const cell = (name) => row.querySelector(`[data-cell="${name}"]`);
    const result = state.results[algorithm];
    const isRunning = state.running === algorithm;

    row.dataset.status = isRunning ? 'running' : (result?.status ?? 'idle');
    row.classList.toggle('is-shown', state.solution?.algorithm === algorithm);
    cell('status').textContent = isRunning ? 'Buscando…' : (result ? STATUS_TEXT[result.status] : 'Sin ejecutar');
    const hasNumbers = result && result.status !== 'cancelled';
    cell('cost').textContent = result?.status === 'solved' ? result.moves.length : '–';
    cell('nodes').textContent = hasNumbers ? numberFormat.format(result.expandedNodes) : '–';
    cell('time').textContent = hasNumbers ? formatTime(result.searchTimeMs) : '–';
  }

  $('summary').textContent = compareResults();
  $('limits-note').textContent =
    `Límite por búsqueda: ${numberFormat.format(DEFAULT_LIMITS.maxExpandedNodes)} nodos expandidos ` +
    `o ${DEFAULT_LIMITS.maxTimeMs / 1000} segundos.`;
}

/** Frase que compara BFS contra A* cuando hay resultados de los dos. */
function compareResults() {
  const { bfs, astar } = state.results;
  if (!bfs || !astar) return '';
  if (bfs.status === 'solved' && astar.status === 'solved') {
    if (bfs.moves.length === 0) return '';
    const fewer = bfs.expandedNodes <= astar.expandedNodes ? bfs : astar;
    const more = fewer === bfs ? astar : bfs;
    const sameCost = bfs.moves.length === astar.moves.length
      ? `Los dos encontraron una solución de ${bfs.moves.length} ${plural(bfs.moves.length, 'giro', 'giros')}.`
      : `BFS encontró ${bfs.moves.length} giros y A* ${astar.moves.length}.`;
    if (fewer.expandedNodes === more.expandedNodes) return `${sameCost} Expandieron la misma cantidad de nodos.`;
    const ratio = more.expandedNodes / Math.max(fewer.expandedNodes, 1);
    const ratioText = ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1);
    return `${sameCost} ${ALGORITHM_NAME[fewer.algorithm]} expandió ${ratioText} veces menos nodos que ${ALGORITHM_NAME[more.algorithm]}.`;
  }
  if (bfs.status === 'limit' && astar.status === 'solved') {
    return 'BFS llegó al límite sin encontrar solución; A* sí la encontró gracias a la heurística.';
  }
  if (bfs.status === 'solved' && astar.status === 'limit') {
    return 'A* llegó al límite sin encontrar solución; BFS sí la encontró.';
  }
  if (bfs.status === 'limit' && astar.status === 'limit') {
    return 'Ninguno encontró solución dentro del límite: la mezcla es demasiado profunda.';
  }
  return '';
}

/** Lista de giros de la solución y botones del reproductor. */
function renderPlayback() {
  const solution = state.solution;
  const list = $('solution-moves');
  list.replaceChildren();

  if (solution) {
    solution.moves.forEach((move, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'move-chip';
      button.textContent = MOVES[move].label;
      button.style.setProperty('--face', faceColor(move));
      button.title = `Ir al paso ${index + 1}`;
      button.disabled = state.animating;
      if (index < solution.step) button.dataset.state = 'done';
      if (index === solution.step - 1) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => jumpToStep(index + 1));
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  const total = solution?.moves.length ?? 0;
  const step = solution?.step ?? 0;
  $('step-count').textContent = solution && total > 0
    ? `${ALGORITHM_NAME[solution.algorithm]}: paso ${step} de ${total}`
    : '';
  $('solution-hint').hidden = total > 0;
  $('solution-hint').textContent = solution
    ? 'El cubo ya está resuelto: la solución no tiene giros.'
    : 'Mezcla el cubo y resuélvelo para ver aquí cada giro de la solución.';

  // Si los dos algoritmos resolvieron, se puede elegir cuál solución ver.
  const bothSolved = ['bfs', 'astar'].every((a) => state.results[a]?.status === 'solved') && total > 0;
  $('solution-switch').hidden = !bothSolved;
  for (const algorithm of ['bfs', 'astar']) {
    const button = $(`show-${algorithm}`);
    button.setAttribute('aria-pressed', String(solution?.algorithm === algorithm));
    button.disabled = state.animating;
  }

  const idle = !state.animating || state.playing;
  $('step-start').disabled = !total || step === 0 || state.animating;
  $('step-prev').disabled = !total || step === 0 || state.animating;
  $('step-next').disabled = !total || step >= total || state.animating;
  $('step-play').disabled = !total || !idle;
  $('step-play').textContent = state.playing ? 'Pausar' : (total && step >= total ? 'Repetir' : 'Reproducir');
}

/** Color de la cara que gira un movimiento (el de su centro, que nunca se mueve). */
function faceColor(move) {
  return COLORS[SOLVED_KEY[FACES.indexOf(MOVES[move].face) * 9 + 4]];
}

/** Actualiza todo lo que depende del estado. */
function render() {
  const busy = state.animating || Boolean(state.running);
  for (const id of ['scramble-btn', 'reset-btn', 'solve-bfs', 'solve-astar', 'solve-both', 'scramble-length']) {
    $(id).disabled = busy;
  }
  for (const button of $('manual-moves').querySelectorAll('button')) button.disabled = busy;
  $('cancel-btn').hidden = !state.running;

  renderScramble();
  renderResults();
  renderPlayback();
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

/** Crea los 12 botones de giro manual, agrupados por cara: R R′, L L′, ... */
function buildManualButtons() {
  const container = $('manual-moves');
  let pair = null;
  MOVE_NAMES.forEach((move, index) => {
    if (index % 2 === 0) { // cada cara tiene dos giros: normal e inverso
      pair = document.createElement('div');
      pair.className = 'pair';
      container.appendChild(pair);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move-chip';
    button.textContent = MOVES[move].label;
    button.style.setProperty('--face', faceColor(move));
    button.setAttribute('aria-label', `Girar ${MOVES[move].label}`);
    button.addEventListener('click', () => manualTurn(move));
    pair.appendChild(button);
  });
}

buildManualButtons();
$('scramble-btn').addEventListener('click', scrambleCube);
$('reset-btn').addEventListener('click', resetCube);
$('reset-camera').addEventListener('click', () => view?.resetCamera());
$('solve-bfs').addEventListener('click', () => solve(['bfs']));
$('solve-astar').addEventListener('click', () => solve(['astar']));
$('solve-both').addEventListener('click', () => solve(['bfs', 'astar']));
$('cancel-btn').addEventListener('click', () => solver.cancel());
$('show-bfs').addEventListener('click', () => { loadSolution('bfs'); render(); });
$('show-astar').addEventListener('click', () => { loadSolution('astar'); render(); });
$('step-start').addEventListener('click', () => jumpToStep(0));
$('step-prev').addEventListener('click', stepBackward);
$('step-next').addEventListener('click', () => { state.playing = false; stepForward(); });
$('step-play').addEventListener('click', togglePlay);

// Flechas izquierda/derecha para retroceder o avanzar un paso.
document.addEventListener('keydown', (event) => {
  if (!state.solution || event.target.closest('input, select, textarea')) return;
  if (event.key === 'ArrowRight') { state.playing = false; stepForward(); }
  if (event.key === 'ArrowLeft') stepBackward();
});

showState();
render();
