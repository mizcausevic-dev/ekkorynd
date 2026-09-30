import type { CellCoord } from './types';

/** Deterministic 32-bit LCG. Same seed yields same sequence across runs. */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 123456789;
  }

  /** Returns integer in [0, 2^32). */
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state;
  }

  /** Returns float in [0, 1). */
  nextFloat(): number {
    return this.next() / 4294967296;
  }

  /** Returns integer in [min, max). */
  nextInt(min: number, max: number): number {
    return Math.floor(min + this.nextFloat() * (max - min));
  }
}

/** Stable string hash to derive a numeric seed. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function coordKey(c: CellCoord): string {
  return `${c.row},${c.col}`;
}

export function sameCoord(a: CellCoord, b: CellCoord): boolean {
  return a.row === b.row && a.col === b.col;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Generate an integer hash from a Date (YYYYMMDD). */
export function dateSeed(date: Date): number {
  const iso = date.toISOString().slice(0, 10).replace(/-/g, '');
  return hashString(iso);
}
