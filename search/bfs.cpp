#include "search.hpp"
#include "../cube/cube.hpp"
#include <queue>
#include <unordered_set>
#include <vector>
#include <string>
#include <algorithm>

namespace rubiks {

std::vector<Move> solveBFS(const Cube& start) {
    struct BFSNode {
        Cube cube;
        int g;
        int parent;
        Move move;
    };

    std::vector<BFSNode> nodes;
    std::queue<int> openQueue;
    std::unordered_set<std::string> closed;

    nodes.push_back({start, 0, -1, allowedMoves[0]});
    openQueue.push(0);

    while (!openQueue.empty()) {
        int idx = openQueue.front();
        openQueue.pop();

        Cube curCube = nodes[idx].cube;
        int curG = nodes[idx].g;
        std::string key = stateKey(curCube);

        if (closed.count(key)) continue;
        closed.insert(key);

        if (isSolved(curCube)) {
            std::vector<Move> path;
            for (int i = idx; nodes[i].parent != -1; i = nodes[i].parent)
                path.push_back(nodes[i].move);
            std::reverse(path.begin(), path.end());
            return path;
        }

        for (Move m : allowedMoves) {
            Cube next = applyMove(curCube, m);
            std::string nextKey = stateKey(next);
            
            if (closed.count(nextKey)) continue;

            nodes.push_back({next, curG + 1, idx, m});
            openQueue.push(static_cast<int>(nodes.size()) - 1);
        }
    }
    return {};
}

} // namespace rubiks
