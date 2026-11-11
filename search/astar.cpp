#include "search.hpp"
#include "search_internal.hpp"
#include <queue>
#include <unordered_map>

namespace rubiks {
namespace {
struct Node { Cube cube; int g; std::size_t parent; Move move; };
struct OpenEntry { int f; std::size_t index; };
struct CompareOpen {
    bool operator()(const OpenEntry& a, const OpenEntry& b) const {
        return a.f != b.f ? a.f > b.f : a.index > b.index;
    }
};
}
SearchResult solveAStar(const Cube& initial, const SearchLimits& limits) {
    const auto start = detail::Clock::now();
    SearchResult result;
    std::vector<Node> nodes{{initial, 0, static_cast<std::size_t>(-1), Move::R}};
    std::priority_queue<OpenEntry, std::vector<OpenEntry>, CompareOpen> open;
    std::unordered_map<std::string, int> bestG{{stateKey(initial), 0}};
    open.push({heuristic(initial), 0});
    while (!open.empty()) {
        const auto current = open.top().index;
        open.pop();
<<<<<<< HEAD

        Cube curCube = nodes[idx].cube;
        int curG = nodes[idx].g;
        std::string key = stateKey(curCube);
        if (closed.count(key)) continue;
        closed.insert(key);
        if(isSolved(curCube)) {
            std::vector<Move> path;
            for(int i = idx; nodes[i].parent != -1; i = nodes[i].parent)
                path.push_back(nodes[i].move);
            std::reverse(path.begin(), path.end());
            return path;
=======
        const Node node = nodes[current];
        const auto key = stateKey(node.cube);
        if (node.g != bestG.at(key)) continue;
        if (isSolved(node.cube)) {
            detail::reconstructPath(result, nodes, current);
            result.searchTimeMs = detail::elapsedMs(start);
            return result;
>>>>>>> main
        }
        if (detail::limitReached(result, limits, start)) {
            result.searchTimeMs = detail::elapsedMs(start);
            return result;
        }
        ++result.expandedNodes;
        for (Move move : allowedMoves) {
            Cube next = applyMove(node.cube, move);
            const auto nextKey = stateKey(next);
            const int g = node.g + 1;
            const auto previous = bestG.find(nextKey);
            if (previous != bestG.end() && previous->second <= g) continue;
            bestG[nextKey] = g;
            const int f = g + heuristic(next);
            nodes.push_back({next, g, current, move});
            open.push({f, nodes.size() - 1});
        }
    }
    result.status = SearchStatus::Exhausted;
    result.searchTimeMs = detail::elapsedMs(start);
    return result;
}
}
<<<<<<< HEAD

}
=======
>>>>>>> main
