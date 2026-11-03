/**
 * Deterministic seeded RNG (mulberry32) + hash helpers.
 * Same seed -> same sequence on every platform. Used for all procedural
 * decisions so a SEED value regenerates an organism exactly.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Random integer seed for RANDOMIZE. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

export function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Perturb v by +-frac, clamped to [min,max]. Used by MUTATE. */
export function perturb(v: number, frac: number, min: number, max: number, rng: () => number): number {
  const span = max - min;
  const nv = v + (rng() * 2 - 1) * frac * span;
  return Math.min(max, Math.max(min, nv));
}
