// The only implemented function is a toolchain smoke check.
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WEB_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WEB_EXPORT
#endif

extern "C" WEB_EXPORT int skeleton_version() {
    return 1;
}

// TODO: Expose the shared cube/search API to JavaScript.
// std::array, std::vector, and C++ structs do not cross the boundary automatically.
// Agree on encoding, errors, and memory ownership before implementing the bridge.
