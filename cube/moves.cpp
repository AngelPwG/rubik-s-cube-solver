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
		default:
		 	break;
	}	
	return next;
}

}
