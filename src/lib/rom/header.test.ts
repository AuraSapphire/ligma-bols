import { describe, expect, it } from "vitest";
import { computeHeaderChecksum, parseHeader, validate, NINTENDO_LOGO, HEADER_SIZE } from "./header";
import { makeDemoBytes } from "./demo";

describe("computeHeaderChecksum", () => {
  it("returns 0xE7 for an all-zero header region", () => {
    // -(0) - 0x19 = -25 mod 256 = 231
    expect(computeHeaderChecksum(new Uint8Array(HEADER_SIZE))).toBe(0xe7);
  });
  it("matches the GBATEK formula for arbitrary bytes", () => {
    const b = new Uint8Array(HEADER_SIZE);
    for (let i = 0xa0; i <= 0xbc; i++) b[i] = (i * 7) & 0xff;
    let sum = 0;
    for (let i = 0xa0; i <= 0xbc; i++) sum += b[i];
    expect(computeHeaderChecksum(b)).toBe(((-sum - 0x19) % 256 + 256) % 256);
  });
  it("throws on buffers too short", () => {
    expect(() => computeHeaderChecksum(new Uint8Array(10))).toThrow(RangeError);
  });
});

describe("parseHeader safety", () => {
  it("returns null for files smaller than the header", () => {
    expect(parseHeader(new Uint8Array(0))).toBeNull();
    expect(parseHeader(new Uint8Array(100))).toBeNull();
    expect(parseHeader(new Uint8Array(HEADER_SIZE - 1))).toBeNull();
  });
  it("reports an error warning for short files", () => {
    const w = validate(50, null, "tiny.gba");
    expect(w.some((x) => x.severity === "error")).toBe(true);
  });
  it("reports empty files", () => {
    expect(validate(0, null, "x.gba")[0].message).toMatch(/empty/);
  });
});

describe("demo bytes", () => {
  it("have a valid checksum but a blank logo", () => {
    const h = parseHeader(makeDemoBytes())!;
    expect(h.checksumValid).toBe(true);
    expect(h.logoStatus).toBe("empty");
    expect(h.gameCode).toBe("DEMO");
  });
  it("logo reference is 156 bytes", () => {
    expect(NINTENDO_LOGO.length).toBe(156);
  });
});