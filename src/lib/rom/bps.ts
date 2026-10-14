/** BPS patch application with source, target, and patch CRC-32 validation. */
const BPS_MAGIC = [0x42, 0x50, 0x53, 0x31];
const MAX_BYTES = 64 * 1024 * 1024;

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readNumber(bytes: Uint8Array, state: { cursor: number }, end: number): number {
  let value = 0;
  let shift = 1;
  while (true) {
    if (state.cursor >= end) throw new Error("BPS patch is truncated while reading a number.");
    const x = bytes[state.cursor++];
    value += (x & 0x7f) * shift;
    if (!Number.isSafeInteger(value)) throw new Error("BPS number is too large.");
    if (x & 0x80) return value;
    shift *= 128;
    value += shift;
    if (!Number.isSafeInteger(value) || shift > Number.MAX_SAFE_INTEGER / 128) throw new Error("BPS number is too large.");
  }
}

function readSigned(bytes: Uint8Array, state: { cursor: number }, end: number): number {
  const encoded = readNumber(bytes, state, end);
  const magnitude = Math.floor(encoded / 2);
  return encoded & 1 ? -magnitude : magnitude;
}

/** Apply a BPS patch without mutating the source. All CRCs and bounds are checked. */
export function applyBpsPatch(source: Uint8Array, patch: Uint8Array): Uint8Array {
  if (patch.length < 16 || !BPS_MAGIC.every((v, i) => patch[i] === v)) throw new Error("This is not a valid BPS patch (missing BPS1 header).");
  const footer = patch.length - 12;
  const expectedSourceCrc = readU32LE(patch, footer);
  const expectedTargetCrc = readU32LE(patch, footer + 4);
  const expectedPatchCrc = readU32LE(patch, patch.length - 4);
  if (crc32(source) !== expectedSourceCrc) throw new Error("The patch source checksum does not match this file. Check that you selected the correct ROM/version.");
  if (crc32(patch.subarray(0, patch.length - 4)) !== expectedPatchCrc) throw new Error("BPS patch checksum failed; the patch may be damaged.");

  const state = { cursor: 4 };
  const sourceSize = readNumber(patch, state, footer);
  const targetSize = readNumber(patch, state, footer);
  const metadataSize = readNumber(patch, state, footer);
  if (sourceSize !== source.length) throw new Error(`Patch expects ${sourceSize} source bytes, but this file has ${source.length}.`);
  if (targetSize > MAX_BYTES) throw new Error("Patch output would exceed 64 MiB.");
  if (state.cursor + metadataSize > footer) throw new Error("BPS metadata extends beyond the patch data.");
  state.cursor += metadataSize;
  const target = new Uint8Array(targetSize);
  let out = 0;
  let sourceRelative = 0;
  let targetRelative = 0;

  while (out < targetSize) {
    const action = readNumber(patch, state, footer);
    const mode = action & 3;
    const length = Math.floor(action / 4) + 1;
    if (out + length > targetSize) throw new Error("BPS command writes beyond the target size.");
    if (mode === 0) {
      if (out + length > source.length) throw new Error("BPS SourceRead runs beyond the source file.");
      target.set(source.subarray(out, out + length), out);
    } else if (mode === 1) {
      if (state.cursor + length > footer) throw new Error("BPS TargetRead data is truncated.");
      target.set(patch.subarray(state.cursor, state.cursor + length), out);
      state.cursor += length;
    } else if (mode === 2) {
      sourceRelative += readSigned(patch, state, footer);
      if (sourceRelative < 0 || sourceRelative + length > source.length) throw new Error("BPS SourceCopy points outside the source file.");
      target.set(source.subarray(sourceRelative, sourceRelative + length), out);
      sourceRelative += length;
    } else {
      targetRelative += readSigned(patch, state, footer);
      if (targetRelative < 0 || targetRelative >= out) throw new Error("BPS TargetCopy points to bytes that do not exist yet.");
      for (let j = 0; j < length; j++) {
        if (targetRelative + j < 0 || targetRelative + j >= out + j) throw new Error("BPS TargetCopy references invalid output.");
        target[out + j] = target[targetRelative + j];
      }
      targetRelative += length;
    }
    out += length;
  }

  if (state.cursor !== footer) throw new Error("BPS patch contains unexpected command data.");
  if (crc32(target) !== expectedTargetCrc) throw new Error("BPS output checksum failed.");
  return target;
}
