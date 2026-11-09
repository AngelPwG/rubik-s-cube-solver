#include "cube.hpp"

namespace rubiks {

void passColumn
void passColumn(int column, Face& rec, const Face& pas, bool reversed = false){
	if (!reversed)
	for (int i = 0; i < 3; ++i)
		rec[i][column] = pas[i][column];
	else
	for (int i = 0; i < 3; ++i)
		rec[i][column] = pas[2 - i][column];
}
void passReversedRow(int row, Face& rec, const Face& pas){
	for (int i = 0; i < 3; ++i)
		rec[row][i] = pas[row][2 - i];
}
void rotateFace(bool clockwise, Face& f){
	Face copy = f;
	if (!clockwise)
	for (int i = 0; i < 3; ++i){
		for (int j = 0, k = 2; j < 3; ++j, --k){
			f[k][i] = copy[i][j];
		}
	}
	else
	for (int i = 0; i < 3; ++i){
		for (int j = 0, k = 2; j < 3; ++j, --k){
			f[i][j] = copy[k][i];
		}
	}
}
Cube applyMove(const Cube& cube, Move move){
	Cube next = cube;
	switch(move){
		case Move::R:
			passColumn(2, next.front, cube.down);
			passColumn(2, next.back, cube.up, true);
			passColumn(2, next.up, cube.front);
			passColumn(2, next.down, cube.back, true);
			rotateFace(true, next.right);
			break;
		case Move::Ri:
			passColumn(2, next.front, cube.up);
			passColumn(2, next.back, cube.down, true);
			passColumn(2, next.up, cube.back, true);
			passColumn(2, next.down, cube.front);
			rotateFace(false, next.right);
			break;
		case Move::L:
			passColumn(0, next.front, cube.up);
			passColumn(0, next.back, cube.down, true);
			passColumn(0, next.up, cube.back, true);
			passColumn(0, next.down, cube.front);
			rotateFace(true, next.left);
			break;
		case Move::Li:
			passColumn(0, next.front, cube.down);
			passColumn(0, next.back, cube.up, true);
			passColumn(0, next.up, cube.front);
			passColumn(0, next.down, cube.back, true);
			rotateFace(false, next.left);
			break;
		case Move::U:
			next.front[0] = cube.right[0];
			passReversedRow(0, next.back, cube.left);
			next.left[0] = cube.front[0];
			passReversedRow(0, next.right, cube.back);
			rotateFace(true, next.up);
			break;
		case Move::Ui:
			next.front[0] = cube.left[0];
			passReversedRow(0, next.back, cube.right);
			next.right[0] = cube.front[0];
			passReversedRow(0, next.left, cube.back);
			rotateFace(false, next.up);
			break;
		case Move::D:
			next.front[0] = cube.left[0];
			passReversedRow(0, next.back, cube.right);
			passReversedRow(0, next.left, cube.back);
			next.right[0] = cube.front[0];
			rotateFace(true, next.down);
			break;
		case Move::Di:
			next.front[0] = cube.right[0];
			passReversedRow(0, next.back, cube.left);
			next.left[0] = cube.front[0];
			passReversedRow(0, next.right, cube.back);
			rotateFace(false, next.up);
			break;
		case Move::F:

			break;
		case Move::Fi:
			break;
		case Move::B:
			break;
		case Move::Bi:
			break;
		default:
		 	break;
	}
	return next;
}

}
