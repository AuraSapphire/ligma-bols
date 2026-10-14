# PokéForge Studio — beginner-friendly GBA ROM workbench

PokéForge Studio is a browser-based workbench for inspecting and safely experimenting with Game Boy Advance ROM files. It is an early build: the binary tools are real, but it is **not yet a complete Pokémon game-data editor**.

## Privacy and safety
- Files are read in your browser; ROM bytes are not uploaded to a server by these tools.
- The source file is kept unchanged in memory. Patch operations modify a separate working copy.
- Export downloads a new `.gba` file; it never silently overwrites your original.
- Use only ROM files you are legally entitled to use. The app does not provide ROM downloads.
- A run of `00` or `FF` bytes is only a free-space *heuristic*, not proof that a region is safe to overwrite.

## Working features
- Drag-and-drop and file picker for `.gba` / `.bin` files (64 MiB safety limit).
- SHA-256 fingerprint, GBA header fields, Nintendo logo comparison, header checksum calculation, and validation warnings.
- Paged hex viewer with offset navigation.
- Friendly dashboard with ROM checkup, patching, search, and utility panels.
- Apply IPS patches to a working copy, with record and size validation.
- Create an IPS patch between the original bytes and the current working copy.
- Export the current working copy as a new `.gba` file.
- Undo the most recent patch operation.
- Search for byte patterns in hexadecimal, including overlapping matches.
- Compare the current working copy against another file.
- Find long `00` / `FF` runs and display their offsets and lengths.
- Basic game-code labels for selected known Pokémon GBA releases; unknown codes remain explicitly unknown.
- Synthetic demo mode for testing the interface without a real game.

## Not implemented yet
- Reliable, verified profile support for reading/writing Pokémon species, moves, items, trainers, wild encounters, evolutions, shops, maps, scripts, and text pointers across multiple ROM revisions.
- Safe pointer allocation, compressed asset repacking, and writing sprite/palette changes back into real games.
- BPS patch support.
- Persistent project files and multi-step undo history.
- A real-game compatibility suite across verified clean ROM revisions.

The game-specific editors must use verified per-game/per-revision layouts; blindly writing guessed offsets can corrupt a ROM. Until a matching profile exists, these features should remain marked as limited rather than pretend to edit the game correctly.

## Development
- Install dependencies with your preferred package manager, then run `npm run dev`.
- Run tests with `npm test`.
- Build with `npm run build`.

Main modules:
- `src/lib/rom/header.ts`: GBA header parsing and validation.
- `src/lib/rom/ips.ts`: pure IPS patch apply/create helpers.
- `src/lib/rom/tools.ts`: game-code labels, byte search, file comparison, free-space heuristic, hex parsing.
- `src/routes/index.tsx`: beginner-oriented UI and local working-copy workflow.
- `src/lib/rom/*.test.ts`: unit tests for binary helpers.
