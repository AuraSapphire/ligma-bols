/** Safe, pure utilities for working with GBA ROM byte arrays. */
export interface ByteRange { start: number; end: number; length: number; value: 0x00 | 0xff; }

export const GBA_GAME_CODES: Record<string, string> = {
  BPRE: "Pokémon FireRed (USA)", BPGE: "Pokémon LeafGreen (USA)",
  BPEE: "Pokémon Emerald (USA)", AXVE: "Pokémon Ruby (USA)", AXPE: "Pokémon Sapphire (USA)",
  BPRJ: "Pokémon FireRed (Japan)", BPGJ: "Pokémon LeafGreen (Japan)",
  BPEJ: "Pokémon Emerald (Japan)", AGBE: "Pokémon Ruby (Europe)", AGFE: "Pokémon FireRed (Europe)",
};

export function identifyGameCode(code: string): { name: string; known: boolean } {
  const clean = code.trim().toUpperCase();
  return GBA_GAME_CODES[clean] ? { name: GBA_GAME_CODES[clean], known: true } : { name: clean ? `Unknown game code: ${clean}` : "No game code found", known: false };
}

export function findBytes(haystack: Uint8Array, needle: Uint8Array, startAt = 0, limit = 1000): number[] {
  if (!needle.length) throw new Error("Search pattern cannot be empty.");
  const found: number[] = [];
  const start = Math.max(0, Math.floor(startAt));
  for (let i = start; i <= haystack.length - needle.length && found.length < limit; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) { ok = false; break; }
    if (ok) i++, found.push(i - 1);
  }
  return found;
}

export function compareBytes(a: Uint8Array, b: Uint8Array) {
  const length = Math.max(a.length, b.length);
  let differentBytes = 0;
  let firstDifference: number | null = null;
  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) { differentBytes++; if (firstDifference === null) firstDifference = i; }
  }
  return { same: differentBytes === 0, differentBytes, firstDifference, leftLength: a.length, rightLength: b.length, length };
}

/** Finds long runs of 00 or FF. This is a heuristic, not proof that a region is safe to overwrite. */
export function findFreeSpace(bytes: Uint8Array, minLength = 256, maxRanges = 500): ByteRange[] {
  const ranges: ByteRange[] = [];
  const minimum = Math.max(1, Math.floor(minLength));
  let i = 0;
  while (i < bytes.length && ranges.length < maxRanges) {
    const value = bytes[i];
    if (value !== 0 && value !== 0xff) { i++; continue; }
    const start = i;
    while (i < bytes.length && bytes[i] === value) i++;
    if (i - start >= minimum) ranges.push({ start, end: i - 1, length: i - start, value: value as 0x00 | 0xff });
  }
  return ranges;
}

export function parseHexPattern(text: string): Uint8Array {
  const clean = text.trim().replace(/0x/gi, "").replace(/[\s,;:_-]/g, "");
  if (!clean || clean.length % 2 !== 0 || !/^[\da-f]+$/i.test(clean)) throw new Error("Enter hex bytes like DE AD BE EF (whole pairs only).");
  return new Uint8Array(clean.match(/../g)!.map((x) => parseInt(x, 16)));
}

export function parseHexOffset(text: string, length: number): number {
  const raw = text.trim();
  const n = /^0x/i.test(raw) ? Number.parseInt(raw.slice(2), 16) : /^\d+$/.test(raw) ? Number(raw) : Number.parseInt(raw, 16);
  if (!Number.isSafeInteger(n) || n < 0 || n >= length) throw new Error(`Offset must be between 0 and ${(length - 1).toString(16).toUpperCase()} (hex).`);
  return n;
}
