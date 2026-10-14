import { computeHeaderChecksum } from "./header";

/**
 * Synthetic demo bytes. NOT a ROM: logo region is zeroed on purpose and the
 * title is "DEMO" so it can never be mistaken for a real game.
 */
export function makeDemoBytes(size = 64 * 1024): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x2e, 0x00, 0x00, 0xea], 0); // ARM branch
  const text = (s: string, at: number) => [...s].forEach((c, i) => (b[at + i] = c.charCodeAt(0)));
  text("DEMOSYNTHETC", 0xa0);
  text("DEMO", 0xac);
  text("00", 0xb0);
  b[0xb2] = 0x96;
  b[0xbd] = computeHeaderChecksum(b);
  text("POKEFORGE STUDIO SYNTHETIC DEMO DATA - NOT A ROM. ", 0x200);
  let seed = 1337;
  for (let i = 0x400; i < size; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    b[i] = (seed >> 16) & 0xff;
  }
  return b;
}