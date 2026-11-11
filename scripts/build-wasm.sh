#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
extra_sources=(search/bfs.cpp)
extra_flags=()
case "${1:-}" in
  --astar-only) extra_sources=(); extra_flags=(-DRUBIK_ASTAR_ONLY) ;;
  "") ;;
  *) echo "Uso: bash scripts/build-wasm.sh [--astar-only]" >&2; exit 2 ;;
esac
mkdir -p frontend/public/wasm
em++ -std=c++17 -O2 -Wall -Wextra \
  cube/cube.cpp cube/moves.cpp \
  search/astar.cpp search/heuristic.cpp "${extra_sources[@]}" \
  bindings/wasm.cpp "${extra_flags[@]}" \
  --no-entry -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sEXPORTED_FUNCTIONS=_solve_cube -sENVIRONMENT=web,worker,node \
  -sEXPORTED_RUNTIME_METHODS=ccall -sALLOW_MEMORY_GROWTH=1 -sASSERTIONS=1 \
  -o frontend/public/wasm/solver.js
