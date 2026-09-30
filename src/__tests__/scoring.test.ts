import { describe, it, expect } from 'vitest';
import { buildRoundResult, computeScore } from '../scoring';
import type { RoundSpec } from '../types';

const round: RoundSpec = { roundNumber: 1, gridSize: 3, patternSize: 3, revealMs: 1000 };

function cells(indices: number[]): { row: number; col: number }[] {
  return indices.map(i => ({ row: Math.floor(i / 3), col: i % 3 }));
}

describe('computeScore', () => {
  it('gives a perfect score bonus when all cells are correct', () => {
    const pattern = cells([0, 1, 2]);
    const score = computeScore(pattern, pattern);
    expect(score.correct).toBe(3);
    expect(score.missed).toBe(0);
    expect(score.falsePositive).toBe(0);
    expect(score.perfect).toBe(true);
    expect(score.roundScore).toBe(1100); // 1000 + 100 bonus
  });

  it('penalizes false positives more heavily than misses', () => {
    const pattern = cells([0, 1, 2]);
    const selected = cells([0, 3, 4, 5]);
    const score = computeScore(pattern, selected);
    expect(score.correct).toBe(1);
    expect(score.missed).toBe(2);
    expect(score.falsePositive).toBe(3);
    // (1/3)*1000 = 333; -2*50 = -100; -3*100 = -300; total = -67 -> clamped to 0
    expect(score.roundScore).toBe(0);
  });

  it('scores a partial round with no false positives', () => {
    const pattern = cells([0, 1, 2, 3]);
    const selected = cells([0, 1]);
    const score = computeScore(pattern, selected);
    expect(score.correct).toBe(2);
    expect(score.missed).toBe(2);
    expect(score.falsePositive).toBe(0);
    expect(score.roundScore).toBe(400); // 500 - 100
  });

  it('returns zero for an empty pattern', () => {
    const score = computeScore([], []);
    expect(score.roundScore).toBe(0);
    expect(score.perfect).toBe(false);
  });

  it('never returns a negative score', () => {
    const pattern = cells([0]);
    const selected = cells([1, 2, 3, 4, 5]);
    const score = computeScore(pattern, selected);
    expect(score.roundScore).toBe(0);
  });
});

describe('buildRoundResult', () => {
  it('records the exact pattern and selection arrays', () => {
    const pattern = cells([0, 4, 8]);
    const selected = cells([0, 4]);
    const result = buildRoundResult(round, pattern, selected);
    expect(result.pattern).toEqual(pattern);
    expect(result.selected).toEqual(selected);
    expect(result.correct).toBe(2);
    expect(result.missed).toBe(1);
    expect(result.falsePositive).toBe(0);
  });
});
