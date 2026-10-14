// Pure, browser-safe GBA ROM header parsing. No I/O, no network.

export const HEADER_SIZE = 0xc0; // 192 bytes

// Reference Nintendo logo bitmap (0x04–0x9F, 156 bytes) as documented in GBATEK.
// Used only to compare bytes for validity; never written anywhere.
const LOGO_HEX =
  "24FFAE51699AA2213D84820A84E409AD11248B98C0817F21A352BE199309CE2010464A4AF82731EC58C7E83382E3CEBF85F4DF94CE4B09C194568AC01372A7FC9F844D73A3CA9A615897A327FC039876231DC7610304AE56BF38840040A70EFDFF52FE036F9530F197FBC08560D68025A963BE03014E38E2F9A234FFBB3E0344780090CB88113A9465C07C6387F03CAFD625E48B380AAC7221D4F807";

export const NINTENDO_LOGO = new Uint8Array(LOGO_HEX.match(/../g)!.map((h) => parseInt(h, 16)));

export type LogoStatus = "valid" | "mismatch" | "empty";
export type Severity = "info" | "warning" | "error";

export interface Warning {
  severity: Severity;
  message: string;
}

export interface GbaHeader {
  entryPoint: Uint8Array;
  entryIsBranch: boolean;
  logoStatus: LogoStatus;
  logoMismatchCount: number;
  title: string;
  titleRaw: Uint8Array;
  gameCode: string;
  makerCode: string;
  fixedValue: number;
  unitCode: number;
  deviceType: number;
  version: number;
  storedChecksum: number;
  computedChecksum: number;
  checksumValid: boolean;
}

/** GBA complement check: -(sum of 0xA0..0xBC) - 0x19, mod 256. */
export function computeHeaderChecksum(bytes: Uint8Array): number {
  if (bytes.length < 0xbd) throw new RangeError("Need at least 0xBD bytes to compute the header checksum");
  let chk = 0;
  for (let i = 0xa0; i <= 0xbc; i++) chk = (chk - bytes[i]) & 0xff;
  return (chk - 0x19) & 0xff;
}

function ascii(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) {
    if (b === 0) break;
    s += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "·";
  }
  return s;
}

export function checkLogo(bytes: Uint8Array): { status: LogoStatus; mismatches: number } {
  const region = bytes.subarray(0x04, 0xa0);
  if (region.every((b) => b === 0) || region.every((b) => b === 0xff)) return { status: "empty", mismatches: 156 };
  let mismatches = 0;
  for (let i = 0; i < 156; i++) if (region[i] !== NINTENDO_LOGO[i]) mismatches++;
  return { status: mismatches === 0 ? "valid" : "mismatch", mismatches };
}

/** Returns null when the buffer is too small to contain a full header. Never throws on short input. */
export function parseHeader(bytes: Uint8Array): GbaHeader | null {
  if (bytes.length < HEADER_SIZE) return null;
  const logo = checkLogo(bytes);
  const computed = computeHeaderChecksum(bytes);
  return {
    entryPoint: bytes.slice(0, 4),
    entryIsBranch: bytes[3] === 0xea, // ARM "B" instruction, condition AL
    logoStatus: logo.status,
    logoMismatchCount: logo.mismatches,
    title: ascii(bytes.subarray(0xa0, 0xac)),
    titleRaw: bytes.slice(0xa0, 0xac),
    gameCode: ascii(bytes.subarray(0xac, 0xb0)),
    makerCode: ascii(bytes.subarray(0xb0, 0xb2)),
    fixedValue: bytes[0xb2],
    unitCode: bytes[0xb3],
    deviceType: bytes[0xb4],
    version: bytes[0xbc],
    storedChecksum: bytes[0xbd],
    computedChecksum: computed,
    checksumValid: computed === bytes[0xbd],
  };
}

export function validate(size: number, header: GbaHeader | null, name: string): Warning[] {
  const w: Warning[] = [];
  if (size === 0) return [{ severity: "error", message: "File is empty (0 bytes)." }];
  if (!/\.(gba|bin)$/i.test(name)) w.push({ severity: "warning", message: "File extension is not .gba or .bin." });
  if (!header) {
    w.push({
      severity: "error",
      message: `File is ${size} bytes — smaller than the 192-byte (0xC0) GBA header. Header fields cannot be read.`,
    });
    return w;
  }
  if (size > 32 * 1024 * 1024)
    w.push({ severity: "warning", message: "File exceeds 32 MiB, the maximum GBA cartridge ROM address space." });
  if ((size & (size - 1)) !== 0)
    w.push({ severity: "info", message: "Size is not a power of two. Common for trimmed or hacked ROMs; not necessarily a problem." });
  if (!header.checksumValid)
    w.push({
      severity: "error",
      message: `Header checksum mismatch: stored 0x${hex2(header.storedChecksum)}, computed 0x${hex2(header.computedChecksum)}. Real hardware will refuse to boot this.`,
    });
  if (header.fixedValue !== 0x96)
    w.push({ severity: "warning", message: `Fixed value at 0xB2 is 0x${hex2(header.fixedValue)}; expected 0x96.` });
  if (header.logoStatus === "empty")
    w.push({ severity: "warning", message: "Nintendo logo region (0x04–0x9F) is blank." });
  else if (header.logoStatus === "mismatch")
    w.push({ severity: "warning", message: `Nintendo logo differs from reference in ${header.logoMismatchCount} of 156 bytes.` });
  if (!header.entryIsBranch)
    w.push({ severity: "warning", message: "Entry point does not look like an ARM branch instruction (byte 3 ≠ 0xEA)." });
  if (header.unitCode !== 0) w.push({ severity: "info", message: `Unit code is 0x${hex2(header.unitCode)}; 0x00 is standard.` });
  return w;
}

export const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
export const hexBytes = (b: Uint8Array) => Array.from(b, hex2).join(" ");