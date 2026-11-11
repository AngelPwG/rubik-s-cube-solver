#pragma once
#include "../cube/cube.hpp"
#include <cstddef>
#include <vector>

namespace rubiks {
enum class SearchStatus { Solved, LimitReached, Exhausted };
struct SearchLimits {
    std::size_t maxExpandedNodes = 1000000;
    double maxTimeMs = 10000.0;
    // Stored states include the frontier, parents and visited records.
    // This is a count bound, not a precise RAM budget in bytes.
    std::size_t maxStoredStates = 1000000;
};
struct SearchResult {
    SearchStatus status = SearchStatus::LimitReached;
    std::vector<Move> moves;
    std::size_t expandedNodes = 0;
    double searchTimeMs = 0.0;
    int solutionCost = 0;
    std::size_t storedStates = 0;
    std::string limitReason; // "nodes", "time", "states", or empty.
};

SearchResult solveBFS(const Cube& initial, const SearchLimits& limits);
SearchResult solveAStar(const Cube& initial, const SearchLimits& limits);
int heuristic(const Cube& cube);
}
