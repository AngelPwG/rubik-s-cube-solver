#include "search.hpp"

namespace rubiks{
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
}
