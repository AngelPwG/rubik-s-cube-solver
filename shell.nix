{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    gcc             # Native C++ compiler: g++
    # clang-tools   # Optional: clangd for Neovim and clang-format
    emscripten      # WebAssembly compiler: em++
    nodejs          # Run the generated JS/Wasm smoke test
    python3         # Local static HTTP server
  ];
}
