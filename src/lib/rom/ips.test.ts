import { describe, expect, it } from "vitest";
import { applyIpsPatch, createIpsPatch } from "./ips";

describe("IPS patches", () => {
  it("applies ordinary records without mutating the source", () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const patch = new Uint8Array([80,65,84,67,72, 0,0,1, 0,2, 9,8, 69,79,70]);
    expect(Array.from(applyIpsPatch(source, patch))).toEqual([1,9,8,4]);
    expect(Array.from(source)).toEqual([1,2,3,4]);
  });
  it("applies RLE records", () => {
    const patch = new Uint8Array([80,65,84,67,72, 0,0,2, 0,0, 0,3, 7, 69,79,70]);
    expect(Array.from(applyIpsPatch(new Uint8Array([1,2,3]), patch))).toEqual([1,2,7,7,7]);
  });
  it("round-trips a generated patch", () => {
    const a = new Uint8Array([1,2,3,4,5]);
    const b = new Uint8Array([1,9,3,8,5,6]);
    expect(Array.from(applyIpsPatch(a, createIpsPatch(a,b)))).toEqual(Array.from(b));
  });
  it("rejects malformed patches", () => {
    expect(() => applyIpsPatch(new Uint8Array(8), new Uint8Array([1,2,3]))).toThrow(/valid IPS/);
  });
});
