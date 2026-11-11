# Frontend: interfaz web del solucionador

Interfaz en HTML, CSS y JavaScript (módulos, sin bundler) con Three.js para el cubo en 3D.
Permite mezclar el cubo, girarlo a mano, resolverlo con BFS o A*, comparar los dos
algoritmos y reproducir la solución paso a paso.

## Cómo ejecutarla

Desde la raíz del repositorio:

```bash
python3 -m http.server 8000 --directory frontend --bind 127.0.0.1
```

Abrir <http://localhost:8000>. Tiene que servirse por HTTP: abrir `index.html` con doble
clic no funciona porque los módulos de JavaScript y el Web Worker no cargan desde `file://`.

No necesita internet: Three.js y la tipografía están en `vendor/`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura de la página. |
| `src/styles.css` | Estilos. |
| `src/main.js` | Conecta controles, vistas y solver. Guarda el estado de la aplicación. |
| `src/cube-model.js` | Modelo del cubo en el navegador: estado de 54 letras, los 12 giros, mezcla aleatoria. Usa las mismas convenciones que `cube/cube.cpp`. |
| `src/cube-view.js` | Vista 3D con Three.js y animación de los giros. |
| `src/cube-net.js` | Mapa 2D del cubo desdoblado. |
| `src/solver-client.js` | Pide búsquedas al Web Worker y valida la solución recibida. |
| `src/solver-worker.js` | Web Worker: ejecuta la búsqueda con WebAssembly o con el respaldo en JavaScript. |
| `src/search-js.js` | BFS y A* en JavaScript, solo como respaldo mientras no esté el módulo Wasm. |
| `tests/` | Pruebas del modelo y de la búsqueda de respaldo. |
| `vendor/` | Three.js 0.170.0 (MIT) y la fuente Rubik (OFL). |

## Motor de búsqueda: WebAssembly o respaldo

Al cargar, la página intenta importar `public/wasm/solver.js` (lo genera
`scripts/build-wasm.sh`). El texto de arriba a la derecha indica qué motor quedó activo:

- **Motor: C++ compilado a WebAssembly**: se usan `solveBFS` y `solveAStar` de `search/`.
- **Motor: JavaScript de respaldo**: el módulo no existe o no exporta `solve_cube`; se usa
  `src/search-js.js`. En este modo la consola del navegador muestra un 404 de
  `solver.js`, que es esperado.

Para las capturas y mediciones del reporte debe decir WebAssembly.

## Contrato con el C++

La interfaz necesita una sola función exportada desde `bindings/wasm.cpp`:

```cpp
const char* solve_cube(const char* stateKey, int algorithm,
                       int maxExpandedNodes, double maxTimeMs);
```

Entradas:

- `stateKey`: las 54 letras que devuelve `stateKey()` (front, back, up, down, left, right;
  cada cara fila por fila).
- `algorithm`: `0` = BFS, `1` = A*.
- `maxExpandedNodes`, `maxTimeMs`: los límites de `SearchLimits`.

Salida: un texto JSON con los campos de `SearchResult`:

```json
{"status":"solved","moves":"Ri U F","expandedNodes":1234,"searchTimeMs":12.5,"solutionCost":3}
```

- `status`: `"solved"`, `"limit"` (se alcanzó un límite) o `"exhausted"` (se acabaron los
  estados). Si la entrada es inválida: `{"status":"error","message":"..."}`.
- `moves`: nombres del enum `Move` separados por espacios, en orden de ejecución.
  Vacío si no hubo solución o si el cubo ya estaba resuelto.

La interfaz aplica `moves` al estado inicial y comprueba que el cubo quede resuelto; si no,
muestra "Solución inválida".

### Puente de referencia

Esta versión ya se compiló de forma nativa con `g++` y devuelve el JSON esperado (se probó
con `solveBFS`/`solveAStar` simulados). Falta probarla compilada con Emscripten.

```cpp
#include "../cube/cube.hpp"
#include "../search/search.hpp"
#include <string>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WEB_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WEB_EXPORT
#endif

namespace {
// Mismo orden que el enum Move de cube.hpp.
const char* const MOVE_NAMES[12] = {"R", "Ri", "L", "Li", "U", "Ui", "D", "Di", "F", "Fi", "B", "Bi"};

// Inverso de stateKey(): arma el cubo a partir de las 54 letras.
bool cubeFromKey(const std::string& key, rubiks::Cube& cube) {
    if (key.size() != 54) return false;
    std::size_t i = 0;
    for (rubiks::Face* face : {&cube.front, &cube.back, &cube.up, &cube.down, &cube.left, &cube.right})
        for (rubiks::Row& row : *face)
            for (char& sticker : row) sticker = key[i++];
    return true;
}
} // namespace

extern "C" WEB_EXPORT const char* solve_cube(const char* stateKey, int algorithm,
                                             int maxExpandedNodes, double maxTimeMs) {
    static std::string out; // debe seguir vivo después del return
    rubiks::Cube cube;
    if (stateKey == nullptr || !cubeFromKey(stateKey, cube)) {
        out = "{\"status\":\"error\",\"message\":\"stateKey invalido\"}";
        return out.c_str();
    }

    rubiks::SearchLimits limits;
    limits.maxExpandedNodes = static_cast<std::size_t>(maxExpandedNodes);
    limits.maxTimeMs = maxTimeMs;
    const rubiks::SearchResult result = algorithm == 0 ? rubiks::solveBFS(cube, limits)
                                                       : rubiks::solveAStar(cube, limits);

    const char* status = result.status == rubiks::SearchStatus::Solved ? "solved"
                       : result.status == rubiks::SearchStatus::LimitReached ? "limit" : "exhausted";
    std::string moves;
    for (rubiks::Move move : result.moves) {
        if (!moves.empty()) moves += ' ';
        moves += MOVE_NAMES[static_cast<int>(move)];
    }

    out = std::string("{\"status\":\"") + status + "\",\"moves\":\"" + moves +
          "\",\"expandedNodes\":" + std::to_string(result.expandedNodes) +
          ",\"searchTimeMs\":" + std::to_string(result.searchTimeMs) +
          ",\"solutionCost\":" + std::to_string(result.solutionCost) + "}";
    return out.c_str();
}
```

`scripts/build-wasm.sh` ya exporta `ccall`, que es lo que usa el worker para llamarla.

### Qué deben cumplir `solveBFS` y `solveAStar`

- Usar la firma de `search/search.hpp`: reciben `(const Cube&, const SearchLimits&)` y
  devuelven `SearchResult`.
- Llenar `moves`, `expandedNodes`, `searchTimeMs`, `solutionCost` y `status`.
- Detenerse y devolver `LimitReached` al pasar `maxExpandedNodes` o `maxTimeMs`.
- Contar igual los nodos expandidos, para que la comparación sea justa: un nodo se cuenta
  cuando se saca de la frontera y se generan sus 12 hijos.

La interfaz manda por defecto 150 000 nodos y 10 000 ms (`DEFAULT_LIMITS` en
`src/search-js.js`).

## Pruebas

Desde la raíz del repositorio, con Node 18 o más reciente:

```bash
node frontend/tests/model.test.mjs    # el modelo JS da los mismos estados que el C++
node frontend/tests/search.test.mjs   # el BFS y A* de respaldo resuelven mezclas de 1 a 6 giros
```

`tests/fixtures.json` se generó ejecutando `cube/cube.cpp` y `cube/moves.cpp`: los 12 giros
y 200 secuencias aleatorias. Si cambian los movimientos o los colores en C++, hay que
regenerarlo y actualizar `src/cube-model.js`.
