/**
 * cube-view.js — Vista 3D del cubo con Three.js.
 *
 * Dibuja el cubo como 26 piezas ("cubies") negras con stickers de colores y
 * anima los giros de cara. La vista no decide nada: recibe el estado como el
 * string de 54 letras (stateKey) y lo pinta siguiendo la tabla STICKERS de
 * cube-model.js, que es donde está escrita la convención de caras, filas y
 * columnas acordada con el C++.
 *
 * Cómo se anima un giro:
 *   1. Las 9 piezas de la capa que gira se cuelgan de un "pivote" en el centro.
 *   2. El pivote rota 90° poco a poco alrededor del eje del movimiento.
 *   3. Al terminar, las piezas regresan a su lugar original y se repintan los
 *      stickers con el estado nuevo. Visualmente es idéntico a haber girado
 *      las piezas, pero evita llevar la cuenta de dónde quedó cada una.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STICKERS, MOVES, COLORS } from './cube-model.js';

const CUBIE_SIZE = 0.97;      // lado de cada pieza (un poco menos de 1 para que se vea la separación)
const STICKER_SIZE = 0.84;    // lado de cada sticker
const STICKER_RADIUS = 0.11;  // redondeo de las esquinas del sticker
const STICKER_LIFT = 0.004;   // separación entre el sticker y la pieza (evita parpadeo)
const AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
];

/** Aceleración suave: empieza lento, acelera y frena al final. */
function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Geometría de un cuadrado con esquinas redondeadas (la forma de un sticker). */
function createStickerGeometry() {
  const h = STICKER_SIZE / 2;
  const r = STICKER_RADIUS;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  return new THREE.ShapeGeometry(shape, 6);
}

/** Textura de una sombra circular difusa para apoyar el cubo en el "piso". */
function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(16, 27, 51, 0.30)');
  gradient.addColorStop(0.6, 'rgba(16, 27, 51, 0.10)');
  gradient.addColorStop(1, 'rgba(16, 27, 51, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export class CubeView {
  /**
   * @param {HTMLElement} container elemento donde se inserta el lienzo 3D
   * @throws si el navegador no puede crear un contexto WebGL
   */
  constructor(container) {
    this.container = container;
    this.animation = null; // giro en curso, o null

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(5.2, 4.4, 7.4); // se ven las caras frente, arriba y derecha

    // Luz ambiental fuerte para que los colores se vean fieles, más una luz
    // direccional que da un poco de volumen a las caras.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c2d0, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 8, 6);
    this.scene.add(sun);

    // Arrastrar con el ratón o el dedo para ver el cubo desde otro ángulo.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 16;

    this.buildCube();
    this.buildShadow();

    // Ajustar el lienzo cuando cambia el tamaño del contenedor.
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  /** Crea las 26 piezas y sus 54 stickers. */
  buildCube() {
    this.root = new THREE.Group();   // contiene las piezas en reposo
    this.pivot = new THREE.Group();  // contiene la capa que está girando
    this.scene.add(this.root, this.pivot);

    const bodyGeometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.6 });
    const stickerGeometry = createStickerGeometry();

    /** @type {Map<string, THREE.Group>} pieza por coordenada "x,y,z" */
    this.cubies = new Map();
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue; // el centro no se ve
          const cubie = new THREE.Group();
          cubie.position.set(x, y, z);
          cubie.userData.home = [x, y, z];
          cubie.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
          this.root.add(cubie);
          this.cubies.set(`${x},${y},${z}`, cubie);
        }
      }
    }

    /** @type {THREE.MeshStandardMaterial[]} material del sticker i del estado */
    this.stickerMaterials = [];
    const forward = new THREE.Vector3(0, 0, 1); // hacia donde "mira" la geometría del sticker
    for (const sticker of STICKERS) {
      const material = new THREE.MeshStandardMaterial({ roughness: 0.45 });
      const mesh = new THREE.Mesh(stickerGeometry, material);
      const normal = new THREE.Vector3(...sticker.normal);
      mesh.position.copy(normal).multiplyScalar(CUBIE_SIZE / 2 + STICKER_LIFT);
      mesh.quaternion.setFromUnitVectors(forward, normal);
      this.cubies.get(sticker.pos.join(',')).add(mesh);
      this.stickerMaterials.push(material);
    }
  }

  /** Sombra suave debajo del cubo. */
  buildShadow() {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({ map: createShadowTexture(), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -2.15;
    this.scene.add(shadow);
  }

  /**
   * Pinta los stickers según el estado.
   * @param {string} key estado de 54 letras (igual que stateKey en C++)
   */
  setState(key) {
    this.finishAnimation();
    this.paint(key);
  }

  /** Cambia el color de los 54 stickers. */
  paint(key) {
    for (let i = 0; i < 54; i++) {
      this.stickerMaterials[i].color.set(COLORS[key[i]] ?? '#888888');
    }
  }

  /**
   * Anima un giro de cara y, al terminar, deja pintado el estado resultante.
   * @param {string} move        nombre del movimiento ('R', 'Ri', ...)
   * @param {string} nextKey     estado del cubo después del giro
   * @param {number} durationMs  duración de la animación (0 = sin animación)
   * @returns {Promise<void>} se resuelve cuando la animación termina
   */
  animateMove(move, nextKey, durationMs) {
    this.finishAnimation();
    if (durationMs <= 0) {
      this.paint(nextKey);
      return Promise.resolve();
    }

    const { axis, layer, turns } = MOVES[move];
    for (const cubie of this.cubies.values()) {
      if (cubie.userData.home[axis] === layer) this.pivot.add(cubie);
    }

    return new Promise((resolve) => {
      this.animation = {
        axis: AXES[axis],
        angle: turns * (Math.PI / 2),
        start: null, // se fija en el primer cuadro
        durationMs,
        nextKey,
        resolve,
      };
    });
  }

  /** Termina de inmediato el giro en curso (si hay uno). */
  finishAnimation() {
    const animation = this.animation;
    if (!animation) return;
    this.animation = null;
    // Regresar las piezas a su lugar y repintar con el estado nuevo.
    this.pivot.quaternion.identity();
    for (const cubie of [...this.pivot.children]) this.root.add(cubie);
    this.paint(animation.nextKey);
    animation.resolve();
  }

  /** Se ejecuta en cada cuadro: avanza la animación y dibuja la escena. */
  frame(time) {
    const animation = this.animation;
    if (animation) {
      if (animation.start === null) animation.start = time;
      const progress = Math.min((time - animation.start) / animation.durationMs, 1);
      this.pivot.quaternion.setFromAxisAngle(animation.axis, animation.angle * easeInOut(progress));
      if (progress >= 1) this.finishAnimation();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** Regresa la cámara a la posición inicial. */
  resetCamera() {
    this.camera.position.set(5.2, 4.4, 7.4);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  /** Ajusta el tamaño del lienzo al de su contenedor. */
  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    // En pantallas angostas se aleja la cámara para que el cubo quepa completo.
    this.camera.fov = width / height < 0.9 ? 44 : 32;
    this.camera.updateProjectionMatrix();
  }
}
