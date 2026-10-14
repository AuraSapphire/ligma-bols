import { describe, expect, it } from "vitest";
import { applyBpsPatch, crc32 } from "./bps";

function varint(n: number): number[] {
  const out: number[] = [];
  while (true) {
    let x = n & 0x7f;
    n = Math.floor(n / 128);
    if (n === 0) { out.push(x | 0x80); return out; }
    out.push(x);
    n--;
  }
}
function le32(n: number) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
function patchFor(source: Uint8Array, target: Uint8Array, command: number, literals: number[] = []) {
  const prefix = [66, 80, 83, 49, ...varint(source.length), ...varint(target.length), ...varint(0), ...varint(command), ...literals];
  const withCrcs = [...prefix, ...le32(crc32(source)), ...le32(crc32(target))];
  return new Uint8Array([...withCrcs, ...le32(crc32(new Uint8Array(withCrcs)))]);
}

describe("BPS patches", () => {
  it("applies SourceRead and verifies checksums", () => {
    const source = new Uint8Array([1, 2, 3]);
    expect(Array.from(applyBpsPatch(source, patchFor(source, source, 8)))).toEqual([1, 2, 3]);
  });
  it("applies TargetRead literal bytes", () => {
    const source = new Uint8Array([1, 2, 3]);
    const target = new Uint8Array([9, 8, 7]);
    expect(Array.from(applyBpsPatch(source, patchFor(source, target, 9, [9, 8, 7])))).toEqual([9, 8, 7]);
  });
  it("rejects wrong source and corrupted patch", () => {
    const source = new Uint8Array([1, 2, 3]);
    const patch = patchFor(source, source, 8);
    expect(() => applyBpsPatch(new Uint8Array([3, 2, 1]), patch)).toThrow(/source checksum/);
    patch[4] ^= 1;
    expect(() => applyBpsPatch(source, patch)).toThrow(/patch checksum/);
  });
});
