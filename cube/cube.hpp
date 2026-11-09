#pragma once
#include <array>
#include <string>

namespace rubiks {
using Row = std::array<char, 3>;
using Face = std::array<Row, 3>;

struct Cube {
    Face front{};
    Face back{};
    Face up{};
    Face down{};
    Face left{};
    Face right{};
};

enum class Move { R, Ri, L, Li, U, Ui, D, Di, F, Fi, B, Bi };
inline constexpr std::array<Move, 12> allowedMoves{
    Move::R, Move::Ri, Move::L, Move::Li,
    Move::U, Move::Ui, Move::D, Move::Di,
    Move::F, Move::Fi, Move::B, Move::Bi
};

Cube createSolvedCube();
bool isSolved(const Cube& cube);
std::string stateKey(const Cube& cube);
Cube applyMove(const Cube& cube, Move move);
}
