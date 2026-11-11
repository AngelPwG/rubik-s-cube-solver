#include "../search/search.hpp"
#include <cstdio>
#include <random>
#include <string>
#include <vector>
 
using namespace rubiks;
 
namespace {
int failures = 0;
 
void check(bool ok, const std::string& name) {
    if (!ok) { ++failures; std::printf("  FAIL: %s\n", name.c_str()); }
}
 
Cube applyAll(Cube c, const std::vector<Move>& moves) {
    for (Move m : moves) c = applyMove(c, m);
    return c;
}
 
// Mezcla de n giros sin repetir la misma cara de forma consecutiva.
Cube scramble(int n, std::mt19937& rng, std::vector<Move>* used = nullptr) {
    Cube c = createSolvedCube();
    int last = -1;
    for (int i = 0; i < n; ++i) {
        int m;
        do { m = static_cast<int>(rng() % 12); } while (last >= 0 && m / 2 == last / 2);
        last = m;
        c = applyMove(c, allowedMoves[m]);
        if (used) used->push_back(allowedMoves[m]);
    }
    return c;
}
 
void testSolvedCube() {
    std::printf("cubo ya resuelto\n");
    const Cube solved = createSolvedCube();
    for (auto solver : {solveBFS, solveAStar}) {
        auto r = solver(solved, SearchLimits{});
        check(r.status == SearchStatus::Solved, "status Solved");
        check(r.moves.empty(), "0 movimientos");
        check(r.solutionCost == 0, "costo 0");
        check(r.expandedNodes == 0, "no expande el nodo meta");
    }
}
 
void testSingleMoves() {
    std::printf("un solo movimiento (12 casos)\n");
    for (Move m : allowedMoves) {
        const Cube c = applyMove(createSolvedCube(), m);
        for (auto solver : {solveBFS, solveAStar}) {
            auto r = solver(c, SearchLimits{});
            check(r.status == SearchStatus::Solved, "status Solved");
            check(r.moves.size() == 1, "longitud 1");
            check(isSolved(applyAll(c, r.moves)), "la solucion resuelve el cubo");
        }
    }
}
 
void testRandomScrambles() {
    std::printf("mezclas aleatorias 1..5 movimientos: BFS vs A*\n");
    std::mt19937 rng(12345);
    for (int n = 1; n <= 5; ++n) {
        for (int t = 0; t < 10; ++t) {
            const Cube c = scramble(n, rng);
            const SearchLimits lim{2000000, 60000.0};
            const auto b = solveBFS(c, lim);
            const auto a = solveAStar(c, lim);
            const std::string tag = "n=" + std::to_string(n) + " t=" + std::to_string(t);
            check(b.status == SearchStatus::Solved, tag + " BFS Solved");
            check(a.status == SearchStatus::Solved, tag + " A* Solved");
            check(isSolved(applyAll(c, b.moves)), tag + " BFS resuelve al reproducir");
            check(isSolved(applyAll(c, a.moves)), tag + " A* resuelve al reproducir");
            check(static_cast<int>(b.moves.size()) <= n, tag + " BFS <= n movimientos");
            check(b.moves.size() == a.moves.size(), tag + " misma longitud (ambos optimos)");
            check(b.solutionCost == static_cast<int>(b.moves.size()), tag + " solutionCost BFS");
            check(a.expandedNodes <= b.expandedNodes || n <= 1, tag + " A* no expande mas que BFS");
        }
    }
}
 
// Con mezcla de 6 giros solo se corre A* (BFS tardaria varios segundos).
void testAStarDepth6() {
    std::printf("A* con mezclas de 6 movimientos\n");
    std::mt19937 rng(777);
    for (int t = 0; t < 5; ++t) {
        const Cube c = scramble(6, rng);
        const auto a = solveAStar(c, SearchLimits{2000000, 60000.0});
        check(a.status == SearchStatus::Solved, "A* Solved");
        check(isSolved(applyAll(c, a.moves)), "A* resuelve al reproducir");
        check(a.moves.size() <= 6, "A* <= 6 movimientos");
    }
}
 
void testBfsOptimalityKnownCase() {
    std::printf("BFS optimo en un caso conocido (R U)\n");
    const Cube c = applyAll(createSolvedCube(), {Move::R, Move::U});
    const auto r = solveBFS(c, SearchLimits{});
    check(r.status == SearchStatus::Solved, "Solved");
    check(r.moves.size() == 2, "exactamente 2 movimientos");
    check(isSolved(applyAll(c, r.moves)), "resuelve");
}
 
void testLimits() {
    std::printf("limites de busqueda\n");
    std::vector<Move> seq{Move::R, Move::U, Move::F, Move::Li, Move::D, Move::Bi, Move::R};
    const Cube c = applyAll(createSolvedCube(), seq);
    for (auto solver : {solveBFS, solveAStar}) {
        auto r = solver(c, SearchLimits{50, 60000.0});
        check(r.status == SearchStatus::LimitReached, "LimitReached por nodos");
        check(r.expandedNodes == 50, "expandio exactamente el maximo");
        check(r.moves.empty(), "sin movimientos al cortar");
 
        auto t = solver(c, SearchLimits{100000000, 0.0});
        check(t.status == SearchStatus::LimitReached, "LimitReached por tiempo");
    }
}
 
void testDoesNotModifyInput() {
    std::printf("la busqueda no modifica el cubo de entrada\n");
    std::mt19937 rng(99);
    const Cube c = scramble(4, rng);
    const std::string before = stateKey(c);
    solveBFS(c, SearchLimits{});
    solveAStar(c, SearchLimits{});
    check(stateKey(c) == before, "stateKey igual antes y despues");
}
}
 
int main() {
    testSolvedCube();
    testSingleMoves();
    testRandomScrambles();
    testBfsOptimalityKnownCase();
    testLimits();
    testDoesNotModifyInput();
    testAStarDepth6();
    if (failures == 0) std::printf("\nTodas las pruebas pasaron.\n");
    else std::printf("\n%d prueba(s) fallaron.\n", failures);
    return failures == 0 ? 0 : 1;
}
