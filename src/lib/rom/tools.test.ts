import { describe, expect, it } from "vitest";
import { compareBytes, findBytes, findFreeSpace, identifyGameCode, parseHexPattern } from "./tools";

describe("ROM tools", () => {
  it("finds overlapping byte patterns", () => {
    expect(findBytes(new Uint8Array([1, 1, 1]), new Uint8Array([1, 1]))).toEqual([0, 1]);
  });
  it("parses spaced hexadecimal patterns", () => {
    expect(Array.from(parseHexPattern("0xDE AD,BE:EF"))).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect(() => parseHexPattern("A")).toThrow();
  });
  it("compares files including length differences", () => {
    expect(compareBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3, 4]))).toMatchObject({
      same: false, differentBytes: 2, firstDifference: 1, leftLength: 2, rightLength: 3,
    });
  });
  it("finds long 00 and FF runs as heuristic ranges", () => {
    expect(findFreeSpace(new Uint8Array([1, 0, 0, 0, 0xff, 0xff, 0xff]), 3)).toEqual([
      { start: 1, end: 3, length: 3, value: 0 },
      { start: 4, end: 6, length: 3, value: 255 },
    ]);
  });
  it("identifies known game codes without guessing unknown ones", () => {
    expect(identifyGameCode("BPEE")).toEqual({ name: "Pokémon Emerald (USA)", known: true });
    expect(identifyGameCode("ZZZZ").known).toBe(false);
  });
});
