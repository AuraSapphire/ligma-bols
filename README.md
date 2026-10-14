# PokéForge Studio — Phase 1 (ROM Inspector)

A browser-only, read-only Game Boy Advance ROM inspector for beginner ROM hackers.

## Privacy
ROM files are read with `File.arrayBuffer()` into memory. Nothing is uploaded, sent to a server, or persisted (no localStorage/IndexedDB). Clearing the file or closing the tab discards it.

## Features
- Drag/drop or file picker (.gba/.bin, max 64 MiB)
- File name, size, SHA-256 via Web Crypto (`crypto.subtle.digest`)
- Header inspector (0x00–0xBD): entry point, Nintendo logo comparison against the GBATEK reference bitmap, title, game code, maker code, fixed value (0x96), unit code, device type, version, header checksum
- Checksum: `(-sum(bytes 0xA0..0xBC) - 0x19) & 0xFF`
- Paged hex viewer (512 bytes per page, 16 bytes/row) with jump-to-offset — only the current page is rendered
- Validation warnings, empty/loading/error states
- Demo mode: 64 KiB of synthetic bytes, title `DEMOSYNTHETC`, blank logo — clearly not a ROM
- Planned module placeholders: Pokémon Data, Sprites, Maps, Trainers, Encounters, Text & Scripts

## Architecture
- `src/lib/rom/header.ts` — pure parsing/validation (no DOM, unit tested)
- `src/lib/rom/demo.ts` — synthetic demo byte generator
- `src/components/forge/` — `HeaderInspector`, `HexViewer`
- `src/routes/index.tsx` — studio shell, session state (React `useState` only)
- Tests: `bunx vitest run` (`src/lib/rom/header.test.ts`)

## Current limitations
- Read-only; no writing, patching, or export
- Does not identify games/versions or parse any Pokémon-specific data
- Whole file is held in memory (fine for ≤32 MiB GBA ROMs)
- Hex viewer has no search or selection yet