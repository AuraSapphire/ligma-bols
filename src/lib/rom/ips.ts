/** IPS patch support. All operations are pure and never mutate the input buffer. */
const MAGIC = [0x50, 0x41, 0x54, 0x43, 0x48];
const EOF = [0x45, 0x4f, 0x46];
const MAX_ROM_BYTES = 64 * 1024 * 1024;

function u24(b: Uint8Array, i: number) { return (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]; }
function put24(out: number[], n: number) { out.push((n >>> 16) & 255, (n >>> 8) & 255, n & 255); }

/** Apply an IPS patch to a copy. Rejects malformed records and unreasonable allocations. */
export function applyIpsPatch(source: Uint8Array, patch: Uint8Array): Uint8Array {
  if (patch.length < 8 || !MAGIC.every((v, i) => patch[i] === v)) throw new Error("This is not a valid IPS patch (missing PATCH header).");
  const writes: Array<{ offset: number; data: Uint8Array }> = [];
  let cursor = 5;
  let maxEnd = source.length;
  let truncateTo: number | null = null;
  let foundEof = false;
  while (cursor + 3 <= patch.length) {
    if (patch[cursor] === 0x45 && patch[cursor + 1] === 0x4f && patch[cursor + 2] === 0x46) {
      cursor += 3;
      foundEof = true;
      if (cursor + 3 === patch.length) { truncateTo = u24(patch, cursor); cursor += 3; }
      break;
    }
    if (cursor + 5 > patch.length) throw new Error("Patch ends in the middle of a record.");
    const offset = u24(patch, cursor); cursor += 3;
    const size = (patch[cursor] << 8) | patch[cursor + 1]; cursor += 2;
    let data: Uint8Array;
    if (size === 0) {
      if (cursor + 3 > patch.length) throw new Error("Patch has a broken RLE record.");
      const count = (patch[cursor] << 8) | patch[cursor + 1];
      const value = patch[cursor + 2]; cursor += 3;
      if (count === 0) throw new Error("Patch has an empty RLE record.");
      data = new Uint8Array(count); data.fill(value);
    } else {
      if (cursor + size > patch.length) throw new Error("Patch record extends past the end of the patch.");
      data = patch.slice(cursor, cursor + size); cursor += size;
    }
    maxEnd = Math.max(maxEnd, offset + data.length);
    if (!Number.isSafeInteger(offset + data.length) || offset + data.length > MAX_ROM_BYTES) throw new Error("Patch would create a file larger than 64 MiB.");
    writes.push({ offset, data });
  }
  if (!foundEof) throw new Error("Patch is missing its EOF marker.");
  if (cursor !== patch.length) throw new Error("Patch contains unexpected bytes after EOF.");
  const finalLength = truncateTo ?? maxEnd;
  if (finalLength < 0 || finalLength > MAX_ROM_BYTES) throw new Error("Invalid output size in patch.");
  const out = new Uint8Array(finalLength);
  out.set(source.subarray(0, Math.min(source.length, finalLength)));
  for (const w of writes) {
    if (w.offset >= finalLength) continue;
    out.set(w.data.subarray(0, finalLength - w.offset), w.offset);
  }
  return out;
}

/** Create a simple valid IPS patch from two byte arrays. Runs are split to fit IPS's 16-bit record size. */
export function createIpsPatch(original: Uint8Array, modified: Uint8Array): Uint8Array {
  const out: number[] = [...MAGIC];
  let i = 0;
  while (i < modified.length) {
    if (i < original.length && original[i] === modified[i]) { i++; continue; }
    const start = i;
    while (i < modified.length && (i >= original.length || original[i] !== modified[i]) && i - start < 0xffff) i++;
    put24(out, start);
    const length = i - start;
    out.push((length >>> 8) & 255, length & 255);
    for (let j = start; j < i; j++) out.push(modified[j]);
    if (out.length > MAX_ROM_BYTES) throw new Error("Generated patch is unexpectedly large.");
  }
  out.push(...EOF);
  if (modified.length !== original.length) {
    if (modified.length > 0xffffff) throw new Error("IPS supports output lengths up to 16 MiB less than 1 byte.");
    put24(out, modified.length);
  }
  return new Uint8Array(out);
}
