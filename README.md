# Rubik's Cube Solver

C++ cube logic and BFS/A* compiled to WebAssembly, with an HTML/CSS/Three.js frontend.

## Start on NixOS

```bash
nix-shell
nvim .
```

## Ownership

- Cube owner: src/cube/ and docs/conventions.md
- BFS owner: src/search/bfs.cpp
- A* owner: src/search/astar.cpp and heuristic.cpp
- Frontend owner: frontend/
- Documentation/testing owner: docs/ and tests/, with contributions from everyone

Agree on the declarations in cube.hpp and search.hpp before implementing them.
All source files include headers, never other .cpp files.

## Native compilation check

```bash
bash scripts/check-cpp.sh
```

This only checks source syntax; it does not validate cube behavior or link a solver.
The test files are placeholders, not passing tests.

## WebAssembly compilation

```bash
bash scripts/build-wasm.sh
```

This produces solver.js and solver.wasm under frontend/public/wasm/.
The initial bridge exports only skeleton_version() for a toolchain smoke check.
It does not expose a cube or working solver yet.

## Frontend preview

```bash
python3 -m http.server 8000 --directory frontend --bind 127.0.0.1
```

Open http://localhost:8000. The initial page is just a placeholder.
The intended frontend source is plain JavaScript modules. Add Three.js with a
pinned import map or introduce a bundler when you implement the view.
For this no-bundler preview, public/ is a literal directory in the URL: generated
Wasm assets are served under /public/wasm/.
