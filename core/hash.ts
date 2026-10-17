// FNV-1a 32-bit (state hashes) and CRC-32/IEEE (run.bin trailer).

export function fnv1a32(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193);
  return h >>> 0;
}

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

/** CRC-32 (IEEE 802.3, reflected, poly 0xEDB88320, init/xorout 0xFFFFFFFF). */
export function crc32(bytes: Uint8Array): number {
  const t = table();
  let c = 0xffffffff;
  for (const b of bytes) c = t[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
