/**
 * cube-net.js — Mapa 2D del cubo (el cubo "desdoblado").
 *
 * Muestra las 6 caras al mismo tiempo, incluidas las que no se ven en la
 * vista 3D. También sirve como respaldo si el navegador no soporta WebGL.
 *
 * Distribución:            U
 *                        L F R B
 *                          D
 *
 * Nota: en el estado, la cara de atrás (B) está guardada "en transparencia"
 * (vista desde el frente). Para dibujarla desdoblada, como se vería al darle
 * la vuelta al cubo, sus columnas se muestran en espejo.
 */
import { FACES, COLORS } from './cube-model.js';

/** Columna y fila de cada cara dentro de la cuadrícula de 4 × 3 caras. */
const FACE_SLOT = {
  up: [1, 0],
  left: [0, 1],
  front: [1, 1],
  right: [2, 1],
  back: [3, 1],
  down: [1, 2],
};

/** Letra de la notación estándar para cada cara. */
const FACE_LETTER = { front: 'F', back: 'B', up: 'U', down: 'D', left: 'L', right: 'R' };

/** Nombre de cada color, para la descripción accesible del mapa. */
const COLOR_NAME = { Y: 'amarillo', O: 'naranja', R: 'rojo', B: 'azul', G: 'verde', W: 'blanco' };

export class CubeNet {
  /** @param {HTMLElement} container elemento donde se construye el mapa */
  constructor(container) {
    this.container = container;
    /** @type {HTMLElement[]} celda del sticker i del estado */
    this.cells = new Array(54);

    FACES.forEach((face, faceIndex) => {
      const [slotCol, slotRow] = FACE_SLOT[face];
      const faceEl = document.createElement('div');
      faceEl.className = 'net-face';
      faceEl.style.gridColumn = String(slotCol + 1);
      faceEl.style.gridRow = String(slotRow + 1);

      for (let row = 0; row < 3; row++) {
        for (let shownCol = 0; shownCol < 3; shownCol++) {
          const col = face === 'back' ? 2 - shownCol : shownCol; // espejo en la cara de atrás
          const cell = document.createElement('span');
          cell.className = 'net-cell';
          if (row === 1 && col === 1) cell.textContent = FACE_LETTER[face]; // el centro nombra la cara
          faceEl.appendChild(cell);
          this.cells[faceIndex * 9 + row * 3 + col] = cell;
        }
      }
      container.appendChild(faceEl);
    });
  }

  /**
   * Pinta el mapa según el estado.
   * @param {string} key estado de 54 letras
   */
  setState(key) {
    for (let i = 0; i < 54; i++) {
      this.cells[i].style.backgroundColor = COLORS[key[i]];
      this.cells[i].dataset.color = key[i];
    }
    const centers = FACES.map((face, f) => `${FACE_LETTER[face]} ${COLOR_NAME[key[f * 9 + 4]]}`);
    this.container.setAttribute('aria-label', `Mapa del cubo desdoblado. Centros: ${centers.join(', ')}.`);
  }
}
