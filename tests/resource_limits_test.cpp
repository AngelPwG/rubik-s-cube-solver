#include "../search/search.hpp"
#include <cassert>
#include <iostream>
using namespace rubiks;
int main() {
    auto cube = createSolvedCube();
    for (auto move : {Move::R, Move::U, Move::F, Move::L, Move::D}) cube = applyMove(cube, move);
    for (auto solve : {solveBFS, solveAStar}) {
        auto limited = solve(cube, SearchLimits{1000000, 10000, 30});
        assert(limited.status == SearchStatus::LimitReached);
        assert(limited.limitReason == "states");
        assert(limited.storedStates == 30 && limited.moves.empty());
        auto nodes = solve(cube, SearchLimits{3, 10000, 1000});
        assert(nodes.limitReason == "nodes" && nodes.expandedNodes == 3);
        auto time = solve(cube, SearchLimits{1000, 0, 1000});
        assert(time.limitReason == "time" && time.expandedNodes == 0);
        auto solved = solve(createSolvedCube(), SearchLimits{0, 0, 1});
        assert(solved.status == SearchStatus::Solved && solved.storedStates == 1);
    }
    std::cout << "OK: límites independientes de nodos, tiempo y estados almacenados en BFS/A*.\n";
}
