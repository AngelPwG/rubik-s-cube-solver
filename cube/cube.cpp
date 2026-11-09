#include "cube.hpp"

namespace rubiks{

Cube createSolvedCube(){
	Row frontRow = Row { 'Y', 'Y', 'Y' };
	Face front = Face {frontRow, frontRow, frontRow};
	Row downRow = Row {'B', 'B', 'B'};
	Face down = Face {downRow, downRow, downRow};
	Row upRow = Row {'R', 'R', 'R'};
	Face up = Face {upRow, upRow, upRow};
	Row leftRow = Row {'G', 'G', 'G'};
	Face left = Face {leftRow, leftRow, leftRow};
	Row rightRow = Row {'W', 'W', 'W'};
	Face right = Face {rightRow, rightRow, rightRow};
	Row backRow = Row {'O', 'O', 'O'};
	Face back = Face {backRow, backRow, backRow};
	return Cube { front, back, up, down, left, right};
}

bool isSolved(const Cube& cube){
	for(const Face* f :{
		&cube.front, &cube.back, &cube.up,
		&cube.down, &cube.left, &cube.right
	}){
		const Face& face = *f;	
		if (
			face[0][0] != face[1][1] || face[0][1] != face[1][1] ||
			face[1][0] != face[1][1] || face[2][1] != face[1][1] ||
			face[2][0] != face[1][1] || face[2][2] != face[1][1] ||
			face[0][2] != face[1][1] || face[1][2] != face[1][1]
		)
			return false;
	}
	return true;
}

std::string stateKey(const Cube& cube){
	std::string key;
	key.reserve(54);
	for(const Face* f :{
		&cube.front, &cube.back, &cube.up,
		&cube.down, &cube.left, &cube.right
	}){
		const Face& face = *f;	
		for(const Row& r : face){
			for(const char c : r){
				key += c;
			}
		}
	}
	return key;
}

}
