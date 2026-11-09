#include "cube.hpp"

namespace rubiks {

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
			next.front[2] = cube.left[2];
			passReversedRow(2, next.back, cube.right);
			passReversedRow(2, next.left, cube.back);
			next.right[2] = cube.front[2];
			rotateFace(true, next.down);
			break;
		case Move::Di:
			next.front[2] = cube.right[2];
			passReversedRow(2, next.back, cube.left);
			next.left[2] = cube.front[2];
			passReversedRow(2, next.right, cube.back);
			rotateFace(false, next.down);
			break;
		case Move::F:
			for (int i = 0; i < 3; ++i) {
				next.right[i][0] = cube.up[2][i];
				next.down[0][i] = cube.right[2 - i][0];
				next.left[i][2] = cube.down[0][i];
				next.up[2][i] = cube.left[2 - i][2];
			}
			rotateFace(true, next.front);
			break;
		case Move::Fi:
			for (int i = 0; i < 3; ++i) {
				next.right[i][0] = cube.down[0][2 - i];
				next.down[0][i] = cube.left[i][2];
				next.left[i][2] = cube.up[2][2 - i];
				next.up[2][i] = cube.right[i][0];
			}
			rotateFace(false, next.front);
			break;
		case Move::B:
			for (int i = 0; i < 3; ++i) {
				next.left[i][0] = cube.up[0][2 - i];
				next.down[2][i] = cube.left[i][0];
				next.right[i][2] = cube.down[2][2 - i];
				next.up[0][i] = cube.right[i][2];
			}
			rotateFace(false, next.back);
			break;
		case Move::Bi:
			for (int i = 0; i < 3; ++i) {
				next.up[0][i] = cube.left[2 - i][0];
				next.left[i][0] = cube.down[2][i];
				next.down[2][i] = cube.right[2 - i][2];
				next.right[i][2] = cube.up[0][i];
			}
			rotateFace(true, next.back);
			break;
		default:
		 	break;
	}
	return next;
}

}
