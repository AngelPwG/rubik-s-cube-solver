#include "search.hpp"
#include <vector>
#include <queue>
#include <string>
#include <unordered_set>
#include <algorithm>
// TODO: Implement solveAStar in namespace rubiks, with lowest f score first.

namespace rubiks{
namespace {
    
    int heuristic(const Cube& c){
        int wrong = 0;
        for(const Face* f : { &c.front, &c.back, &c.up, &c.down, &c.left, &c.right }){
            char center = (*f)[1][1];
            for(const Row& r: *f){
                for(char s : r)
                    if (s != center) ++wrong;
            }
        }
        return (wrong+19)/20;
    }
    
    struct Node {
        Cube cube;
        int g;
        int f;
        int parent;
        Move move;
    };

    struct OpenEntry {
        int f;
        int index;
    };

    struct CompareOpen {
        bool operator()(const OpenEntry& a, const OpenEntry& b) const {
            return a.f  > b.f;
        }
    };
}

std::vector<Move> solveAStar (const Cube& start){
    std::vector<Node> nodes;
    std::priority_queue<OpenEntry, std::vector<OpenEntry>, CompareOpen> open;
    std::unordered_set<std::string> closed;
    nodes.push_back({start, 0, heuristic(start), -1, Move::R});
    open.push({nodes[0].f, 0});

    while(!open.empty()){
        int idx = open.top().index;
        open.pop();

        Cube curCube = nodes[idx].cube;
        int curG = nodes[idx].g;
        std::string_key = stateKey(curCube);
        if (closed.count(key)) continue;
        closed.insert(key);
        if(isSolved(curCube)) {
            std::vector<Move> path;
            for(int i = idx; nodes[i].parent != -1; i = nodes[i].parent)
                path.push_back(nodes[i].move);
            std::reverse(path.begin(), path.end());
            return path;
        }

        for(Move m : allowedMoves) {
            Cube next = applyMove(curCube, m);
            if(closed.count(stateKey(next))) continue;
            int g = curG + 1;
            int f = g + heuristic(next);
            nodes.push_back({next, g, f, idx,m});
            open.push({f, static_cast<int>(nodes.size()) - 1});
        }
    }
    return{};
}

}