/**
 * Format an integer as a zero-padded binary string.
 * Used everywhere in the brutalist UI as the "index" — e.g. 00000001, 0011.
 */
export function bin(n: number, width = 8): string {
  return Math.max(0, Math.floor(n))
    .toString(2)
    .padStart(width, "0");
}

/**
 * Stable short index for an entity given any string id.
 * Hashes the id to a small int, suitable for display as bin(...).
 */
export function shortIndex(id: string, mod = 256): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (h % mod) || 1;
}
