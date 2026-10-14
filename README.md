# PokéForge Studio

Browser-based Pokémon GBA ROM hacking studio prototype. Phase 1 is a read-only ROM inspector.

## Features
- Load `.gba` or `.bin` files locally in the browser
- Inspect GBA header metadata and checksum
- Paged hex viewer and SHA-256 fingerprint
- Synthetic demo data

ROM bytes are processed locally in the browser and are not uploaded by the app.

Editing and ROM export are not implemented yet. See the source tree for the current implementation.
