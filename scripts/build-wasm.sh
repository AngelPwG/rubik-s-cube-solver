#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
mkdir -p frontend/public/wasm
em++ -std=c++17 -O2 -Wall -Wextra \
  src/cube/cube.cpp src/cube/moves.cpp \
  src/search/bfs.cpp src/search/astar.cpp src/search/heuristic.cpp \
  src/bindings/wasm.cpp \
  --no-entry -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sEXPORTED_RUNTIME_METHODS=ccall -sALLOW_MEMORY_GROWTH=1 \
  -o frontend/public/wasm/solver.js
