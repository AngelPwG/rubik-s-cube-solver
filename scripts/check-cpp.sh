#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
g++ -std=c++17 -Wall -Wextra -Wpedantic -fsyntax-only \
  cube/cube.cpp cube/moves.cpp \
  search/bfs.cpp search/astar.cpp search/heuristic.cpp \
  bindings/wasm.cpp
