#pragma once
#include "search.hpp"
#include <algorithm>
#include <chrono>
namespace rubiks::detail {
using Clock = std::chrono::steady_clock;
inline double elapsedMs(Clock::time_point start) {
    return std::chrono::duration<double, std::milli>(Clock::now() - start).count();
}
// Count a node when successor generation begins. Goal nodes are not expanded.
inline bool limitReached(const SearchResult& r, const SearchLimits& limits, Clock::time_point start) {
    return r.expandedNodes >= limits.maxExpandedNodes || elapsedMs(start) >= limits.maxTimeMs;
}
template<class Nodes>
void reconstructPath(SearchResult& r, const Nodes& nodes, std::size_t goal) {
    while (nodes[goal].parent != static_cast<std::size_t>(-1)) {
        r.moves.push_back(nodes[goal].move);
        goal = nodes[goal].parent;
    }
    std::reverse(r.moves.begin(), r.moves.end());
    r.solutionCost = static_cast<int>(r.moves.size());
    r.status = SearchStatus::Solved;
}
}
