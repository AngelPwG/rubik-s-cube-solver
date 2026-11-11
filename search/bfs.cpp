#include "search.hpp"
#include "search_internal.hpp"
#include <queue>
#include <string>
#include <unordered_set>
#include <vector>

namespace rubiks {
namespace {
struct Node { Cube cube; std::size_t parent; Move move; };
}

SearchResult solveBFS(const Cube& initial, const SearchLimits& limits) {
    const auto start = detail::Clock::now();
    SearchResult result;

    std::vector<Node> nodes{{initial, static_cast<std::size_t>(-1), Move::R}};
    std::queue<std::size_t> open;       
    std::unordered_set<std::string> visited{stateKey(initial)};
    open.push(0);

    while (!open.empty()) {
        const std::size_t current = open.front();
        open.pop();
        const Cube node = nodes[current].cube; 
        if (isSolved(node)) {
            detail::reconstructPath(result, nodes, current);
            result.searchTimeMs = detail::elapsedMs(start);
            return result;
        }
        if (detail::limitReached(result, limits, start)) {
            result.status = SearchStatus::LimitReached;
            result.searchTimeMs = detail::elapsedMs(start);
            return result;
        }

        ++result.expandedNodes;
        for (Move move : allowedMoves) {
            Cube next = applyMove(node, move);
            if (!visited.insert(stateKey(next)).second) continue;
            nodes.push_back({next, current, move});
            open.push(nodes.size() - 1);
        }
    }

    result.status = SearchStatus::Exhausted;
    result.searchTimeMs = detail::elapsedMs(start);
    return result;
}
}
