/**
 * cube-model.js — Modelo del cubo del lado del navegador.
 *
 * El "motor" real del proyecto es el C++ de cube/ (compilado a WebAssembly).
 * Este archivo NO lo reemplaza: solo le permite a la interfaz dibujar el cubo
 * y reproducir los giros sin tener que llamar a Wasm por cada movimiento.
 *
 * Usa exactamente las mismas convenciones que cube/cube.cpp:
 *   - El estado es un string de 54 letras (lo mismo que devuelve stateKey()).
 *   - Orden de las caras: front, back, up, down, left, right.
 *   - Cada cara se recorre fila por fila (fila 0 arriba, columna 0 a la izquierda).
 *   - La cara de atrás (back) se guarda "en transparencia": como si se viera
 *     a través del cubo desde el frente.
 *
 * En vez de copiar a mano los 12 casos de moves.cpp, los giros se derivan de la
 * geometría: cada sticker tiene una posición 3D y una normal, y un giro es una
 * rotación de 90° de una capa. Así el modelo y la vista 3D siempre coinciden.
 * La prueba frontend/tests/model.test.mjs confirma que el resultado es idéntico
 * al del C++ para los 12 movimientos.
 */

/** Orden de las caras dentro del string de estado (igual que stateKey en C++). */
export const FACES = ['front', 'back', 'up', 'down', 'left', 'right'];

/** Estado resuelto, con los colores que define createSolvedCube() en cube.cpp. */
export const SOLVED_KEY =
  'YYYYYYYYY' + // front  (amarillo)
  'OOOOOOOOO' + // back   (naranja)
  'RRRRRRRRR' + // up     (rojo)
  'BBBBBBBBB' + // down   (azul)
  'GGGGGGGGG' + // left   (verde)
  'WWWWWWWWW';  // right  (blanco)

/** Color en pantalla de cada letra del estado. */
export const COLORS = {
  Y: '#F7CF2B',
  O: '#F2801D',
  R: '#D62B32',
  B: '#1E5FCF',
  G: '#1F9D55',
  W: '#F4F6F8',
};

/**
 * Posición 3D y normal de cada sticker según su cara, fila y columna.
 * Ejes: +x = derecha, +y = arriba, +z = hacia el observador (frente).
 * Las coordenadas valen -1, 0 o 1 (centro del cubie al que pertenece el sticker).
 */
const FACE_LAYOUT = {
  front: { normal: [0, 0, 1],  pos: (r, c) => [c - 1, 1 - r, 1] },
  back:  { normal: [0, 0, -1], pos: (r, c) => [c - 1, 1 - r, -1] }, // vista en transparencia
  up:    { normal: [0, 1, 0],  pos: (r, c) => [c - 1, 1, r - 1] },  // fila 2 pegada al frente
  down:  { normal: [0, -1, 0], pos: (r, c) => [c - 1, -1, 1 - r] }, // fila 0 pegada al frente
  left:  { normal: [-1, 0, 0], pos: (r, c) => [-1, 1 - r, c - 1] }, // columna 2 pegada al frente
  right: { normal: [1, 0, 0],  pos: (r, c) => [1, 1 - r, 1 - c] },  // columna 0 pegada al frente
};

/**
 * Tabla de los 54 stickers. STICKERS[i] describe la letra i del string de estado.
 * @type {{index:number, face:string, row:number, col:number, pos:number[], normal:number[]}[]}
 */
export const STICKERS = [];
FACES.forEach((face) => {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      STICKERS.push({
        index: STICKERS.length,
        face,
        row,
        col,
        pos: FACE_LAYOUT[face].pos(row, col),
        normal: FACE_LAYOUT[face].normal,
      });
    }
  }
});

/**
 * Los 12 movimientos permitidos, con los mismos nombres que el enum Move de cube.hpp.
 *   axis:   eje alrededor del cual gira la capa (0 = x, 1 = y, 2 = z)
 *   layer:  coordenada de la capa que gira sobre ese eje (-1 o 1)
 *   turns:  +1 = 90° en sentido antihorario visto desde el lado positivo del eje,
 *           -1 = 90° en sentido horario visto desde el lado positivo del eje.
 * Un giro "horario" en notación estándar se mira desde afuera de la cara que gira;
 * por eso R (cara +x) usa -1 y L (cara -x) usa +1.
 */
export const MOVES = {
  R:  { axis: 0, layer: 1,  turns: -1, face: 'right', label: 'R' },
  Ri: { axis: 0, layer: 1,  turns: 1,  face: 'right', label: 'R′' },
  L:  { axis: 0, layer: -1, turns: 1,  face: 'left',  label: 'L' },
  Li: { axis: 0, layer: -1, turns: -1, face: 'left',  label: 'L′' },
  U:  { axis: 1, layer: 1,  turns: -1, face: 'up',    label: 'U' },
  Ui: { axis: 1, layer: 1,  turns: 1,  face: 'up',    label: 'U′' },
  D:  { axis: 1, layer: -1, turns: 1,  face: 'down',  label: 'D' },
  Di: { axis: 1, layer: -1, turns: -1, face: 'down',  label: 'D′' },
  F:  { axis: 2, layer: 1,  turns: -1, face: 'front', label: 'F' },
  Fi: { axis: 2, layer: 1,  turns: 1,  face: 'front', label: 'F′' },
  B:  { axis: 2, layer: -1, turns: 1,  face: 'back',  label: 'B' },
  Bi: { axis: 2, layer: -1, turns: -1, face: 'back',  label: 'B′' },
};

/** Nombres de los movimientos en el mismo orden que allowedMoves en cube.hpp. */
export const MOVE_NAMES = ['R', 'Ri', 'L', 'Li', 'U', 'Ui', 'D', 'Di', 'F', 'Fi', 'B', 'Bi'];

/** Devuelve el movimiento contrario: R ↔ Ri, U ↔ Ui, etc. */
export function inverseMove(move) {
  return move.endsWith('i') ? move.slice(0, -1) : move + 'i';
}

/**
 * Rota un vector entero 90° alrededor de un eje.
 * @param {number[]} v      vector [x, y, z]
 * @param {number} axis     0 = x, 1 = y, 2 = z
 * @param {number} turns    +1 antihorario, -1 horario (visto desde el lado positivo)
 */
function rotate90(v, axis, turns) {
  const [x, y, z] = v;
  if (axis === 0) return turns > 0 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return turns > 0 ? [z, y, -x] : [-z, y, x];
  return turns > 0 ? [-y, x, z] : [y, -x, z];
}

/** Busca el índice del sticker que está en una posición con una normal dadas. */
const stickerAt = new Map(STICKERS.map((s) => [`${s.pos}|${s.normal}`, s.index]));

/**
 * Tabla de permutación de un movimiento: perm[destino] = origen.
 * Es decir, después del giro, la letra en `destino` es la que estaba en `origen`.
 */
function buildPermutation({ axis, layer, turns }) {
  const perm = Array.from({ length: 54 }, (_, i) => i); // por defecto nada se mueve
  for (const s of STICKERS) {
    if (s.pos[axis] !== layer) continue; // el sticker no está en la capa que gira
    const newPos = rotate90(s.pos, axis, turns);
    const newNormal = rotate90(s.normal, axis, turns);
    perm[stickerAt.get(`${newPos}|${newNormal}`)] = s.index;
  }
  return perm;
}

/** Permutación precalculada de cada movimiento. */
export const PERMUTATIONS = Object.fromEntries(
  MOVE_NAMES.map((name) => [name, buildPermutation(MOVES[name])]),
);

/**
 * Aplica un movimiento a un estado y devuelve el estado nuevo (no modifica el original).
 * Equivale a applyMove() de moves.cpp.
 * @param {string} key   estado de 54 letras
 * @param {string} move  nombre del movimiento ('R', 'Ri', ...)
 * @returns {string}
 */
export function applyMove(key, move) {
  const perm = PERMUTATIONS[move];
  if (!perm) throw new Error(`Movimiento desconocido: ${move}`);
  let next = '';
  for (let i = 0; i < 54; i++) next += key[perm[i]];
  return next;
}

/** Aplica una lista de movimientos en orden. */
export function applyMoves(key, moves) {
  return moves.reduce(applyMove, key);
}

/**
 * Indica si el cubo está resuelto: en cada cara, los 9 stickers son del color del centro.
 * Equivale a isSolved() de cube.cpp.
 */
export function isSolved(key) {
  for (let face = 0; face < 6; face++) {
    const center = key[face * 9 + 4];
    for (let i = 0; i < 9; i++) {
      if (key[face * 9 + i] !== center) return false;
    }
  }
  return true;
}

/**
 * Genera una mezcla aleatoria de `length` movimientos.
 * Evita las repeticiones que harían la mezcla más corta de lo pedido:
 *   - la misma cara dos veces seguidas (R seguido de R′ se cancela), y
 *   - la misma cara separada solo por su cara opuesta (en R L R′, como R y L
 *     no se estorban, el primer R y el R′ también se cancelan).
 * Aun así, la solución óptima puede resultar más corta que la mezcla.
 * @param {number} length
 * @param {() => number} random  generador en [0, 1); se puede cambiar en pruebas
 * @returns {string[]}
 */
export function randomScramble(length, random = Math.random) {
  const moves = [];
  while (moves.length < length) {
    const move = MOVE_NAMES[Math.floor(random() * MOVE_NAMES.length)];
    const last = MOVES[moves[moves.length - 1]];
    const beforeLast = MOVES[moves[moves.length - 2]];
    if (last && MOVES[move].face === last.face) continue;
    if (last && beforeLast && MOVES[move].axis === last.axis &&
        MOVES[move].face === beforeLast.face) continue;
    moves.push(move);
  }
  return moves;
}

/** Convierte una lista de movimientos a texto con notación estándar: R U′ F. */
export function formatMoves(moves) {
  return moves.map((m) => MOVES[m].label).join(' ');
}
