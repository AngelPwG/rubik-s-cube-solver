#pragma once
#include "../cube/cube.hpp"
#include <cstddef>
#include <vector>

namespace rubiks {
enum class SearchStatus { Solved, LimitReached, Exhausted };
struct SearchLimits {
    std::size_t maxExpandedNodes = 1000000;
    double maxTimeMs = 10000.0;
};
struct SearchResult {
    SearchStatus status = SearchStatus::LimitReached;
    std::vector<Move> moves;
    std::size_t expandedNodes = 0;
    double searchTimeMs = 0.0;
    int solutionCost = 0;
};

SearchResult solveBFS(const Cube& initial, const SearchLimits& limits);
SearchResult solveAStar(const Cube& initial, const SearchLimits& limits);
int heuristic(const Cube& cube);
}
