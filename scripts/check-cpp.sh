#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
g++ -std=c++17 -Wall -Wextra -Wpedantic -fsyntax-only \
  src/cube/cube.cpp src/cube/moves.cpp \
  src/search/bfs.cpp src/search/astar.cpp src/search/heuristic.cpp \
  src/bindings/wasm.cpp
