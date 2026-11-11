#include "../search/search.hpp"
#include <cmath>
#include <string>
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WEB_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WEB_EXPORT
#endif

namespace {
constexpr const char* names[] = {"R", "Ri", "L", "Li", "U", "Ui", "D", "Di", "F", "Fi", "B", "Bi"};
// Structural validation for the app's fixed centers. Does not prove solvability
// of arbitrary edited inputs; the UI creates valid states through legal moves.
bool cubeFromKey(const std::string& key, rubiks::Cube& cube) {
    if (key.size() != 54) return false;
    const auto solved = rubiks::stateKey(rubiks::createSolvedCube());
    constexpr const char* colors = "YORBGW";
    for (int face = 0; face < 6; ++face) {
        if (key[face * 9 + 4] != solved[face * 9 + 4]) return false;
        int count = 0;
        for (char c : key) if (c == colors[face]) ++count;
        if (count != 9) return false;
    }
    std::size_t i = 0;
    for (auto* face : {&cube.front, &cube.back, &cube.up, &cube.down, &cube.left, &cube.right})
        for (auto& row : *face)
            for (auto& sticker : row) sticker = key[i++];
    return true;
}
}
// Returned storage is owned by the module, valid until the next call.
// ccall(..., 'string', ...) copies it to JS; the caller must not free it.
extern "C" WEB_EXPORT const char* solve_cube(const char* key, int algorithm,
                                             int maxExpandedNodes, double maxTimeMs) {
    static std::string output;
    rubiks::Cube cube;
    if (!key || !cubeFromKey(key, cube))
        return "{\"status\":\"error\",\"message\":\"Estado o colores invalidos\"}";
    if ((algorithm != 0 && algorithm != 1) || maxExpandedNodes < 0 ||
        maxExpandedNodes > 1000000 || !std::isfinite(maxTimeMs) || maxTimeMs < 0 || maxTimeMs > 60000)
        return "{\"status\":\"error\",\"message\":\"Algoritmo o limites invalidos\"}";
    const rubiks::SearchLimits limits{static_cast<std::size_t>(maxExpandedNodes), maxTimeMs};
#ifdef RUBIK_ASTAR_ONLY
    if (algorithm == 0)
        return "{\"status\":\"error\",\"message\":\"BFS de C++ pendiente de integrar\"}";
    const auto result = rubiks::solveAStar(cube, limits);
#else
    const auto result = algorithm == 0 ? rubiks::solveBFS(cube, limits) : rubiks::solveAStar(cube, limits);
#endif
    const char* status = result.status == rubiks::SearchStatus::Solved ? "solved"
                       : result.status == rubiks::SearchStatus::LimitReached ? "limit" : "exhausted";
    std::string moves;
    for (auto move : result.moves) {
        if (!moves.empty()) moves += ' ';
        moves += names[static_cast<int>(move)];
    }
    output = std::string("{\"status\":\"") + status + "\",\"moves\":\"" + moves +
        "\",\"expandedNodes\":" + std::to_string(result.expandedNodes) +
        ",\"searchTimeMs\":" + std::to_string(result.searchTimeMs) +
        ",\"solutionCost\":" + std::to_string(result.solutionCost) + "}";
    return output.c_str();
}
