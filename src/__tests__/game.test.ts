import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildRound, createGameController, dailySeed, generatePattern, MAX_GRID, MIN_GRID, REVEAL_BASE_MS } from '../game';
import { SeededRandom } from '../utils';
import type { Settings } from '../types';

describe('buildRound', () => {
  it('starts at 3x3 with 3 cells for round 1', () => {
    const r = buildRound(1);
    expect(r.gridSize).toBe(3);
    expect(r.patternSize).toBe(3);
    expect(r.revealMs).toBeGreaterThan(REVEAL_BASE_MS);
  });

  it('increases grid size every three rounds', () => {
    expect(buildRound(1).gridSize).toBe(3);
    expect(buildRound(3).gridSize).toBe(3);
    expect(buildRound(4).gridSize).toBe(4);
    expect(buildRound(6).gridSize).toBe(4);
    expect(buildRound(7).gridSize).toBe(5);
  });

  it('caps grid size at MAX_GRID', () => {
    const late = buildRound(100);
    expect(late.gridSize).toBe(MAX_GRID);
    expect(late.patternSize).toBeLessThanOrEqual(MAX_GRID * MAX_GRID - 1);
  });

  it('never exceeds grid capacity', () => {
    for (let i = 1; i <= 50; i++) {
      const r = buildRound(i);
      expect(r.patternSize).toBeLessThanOrEqual(r.gridSize * r.gridSize);
    }
  });
});

describe('generatePattern', () => {
  it('returns the requested number of unique cells', () => {
    const rng = new SeededRandom(12345);
    const pattern = generatePattern(5, 7, rng);
    expect(pattern.length).toBe(7);
    const keys = new Set(pattern.map(c => `${c.row},${c.col}`));
    expect(keys.size).toBe(7);
  });

  it('caps pattern size to grid area', () => {
    const rng = new SeededRandom(1);
    const pattern = generatePattern(3, 20, rng);
    expect(pattern.length).toBe(9);
  });

  it('is deterministic for the same seed', () => {
    const a = generatePattern(5, 8, new SeededRandom(999));
    const b = generatePattern(5, 8, new SeededRandom(999));
    expect(a).toEqual(b);
  });

  it('produces different patterns for different seeds', () => {
    const a = generatePattern(6, 10, new SeededRandom(111));
    const b = generatePattern(6, 10, new SeededRandom(112));
    expect(a).not.toEqual(b);
  });
});

describe('dailySeed', () => {
  it('returns the same seed for the same date', () => {
    const d1 = new Date('2026-09-29T00:00:00Z');
    const d2 = new Date('2026-09-29T23:59:59Z');
    expect(dailySeed(d1)).toBe(dailySeed(d2));
  });

  it('returns different seeds for different dates', () => {
    const a = dailySeed(new Date('2026-09-29'));
    const b = dailySeed(new Date('2026-09-30'));
    expect(a).not.toBe(b);
  });
});

describe('GameController', () => {
  const settings: Settings = { soundEnabled: false, reducedMotion: true };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advanceReveal(game: ReturnType<typeof createGameController>): void {
    vi.advanceTimersByTime(game.getState().round.revealMs + 500);
  }

  it('starts classic mode in reveal phase and transitions to recall', () => {
    const game = createGameController(settings);
    game.startClassic();
    expect(game.getState().phase).toBe('reveal');
    expect(game.getState().round.gridSize).toBe(MIN_GRID);
    advanceReveal(game);
    expect(game.getState().phase).toBe('recall');
  });

  it('allows cell selection during recall and computes results on submit', () => {
    const game = createGameController(settings);
    game.startClassic();
    advanceReveal(game);

    const state = game.getState();
    expect(state.phase).toBe('recall');

    // Select all pattern cells (cheating for the test).
    for (const cell of state.pattern) {
      game.toggleCell(cell);
    }
    game.submit();
    expect(game.getState().phase).toBe('results');
    const result = game.getState().results[0];
    expect(result.correct).toBe(state.pattern.length);
    expect(result.missed).toBe(0);
    expect(result.falsePositive).toBe(0);
    expect(result.perfect).toBe(true);
  });

  it('transitions to the next round after a perfect result', () => {
    const game = createGameController(settings);
    game.startClassic();
    advanceReveal(game);

    for (const cell of game.getState().pattern) game.toggleCell(cell);
    game.submit();
    expect(game.getState().round.roundNumber).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(game.getState().phase).toBe('reveal');
    expect(game.getState().round.roundNumber).toBe(2);
    expect(game.getState().round.gridSize).toBeGreaterThanOrEqual(MIN_GRID);
  });

  it('ends classic mode on a failed round', () => {
    const game = createGameController(settings);
    game.startClassic();
    advanceReveal(game);

    // Submit with zero correct selections.
    game.submit();
    expect(game.getState().phase).toBe('results');

    vi.advanceTimersByTime(2000);
    expect(game.getState().phase).toBe('gameOver');
  });

  it('produces the same daily pattern for the same date', () => {
    const game1 = createGameController(settings);
    const game2 = createGameController(settings);
    const date = new Date('2026-09-29');
    game1.startDaily(date);
    game2.startDaily(date);
    advanceReveal(game1);
    advanceReveal(game2);
    expect(game1.getState().pattern).toEqual(game2.getState().pattern);
  });

  it('supports keyboard focus movement and selection', () => {
    const game = createGameController(settings);
    game.startClassic();
    advanceReveal(game);

    game.moveFocus('down');
    game.moveFocus('right');
    const focused = game.getState().focusedCell;
    expect(focused).not.toBeNull();
    expect(focused!.row).toBeGreaterThanOrEqual(0);
    expect(focused!.col).toBeGreaterThanOrEqual(0);

    game.toggleCell(focused!);
    expect(game.getState().selected.length).toBe(1);

    game.moveFocus('up');
    expect(game.getState().focusedCell!.row).toBe(Math.max(0, focused!.row - 1));
  });

  it('practice mode keeps a fixed grid size across rounds', () => {
    const game = createGameController(settings);
    game.startPractice(4, 6);
    advanceReveal(game);

    for (const cell of game.getState().pattern) game.toggleCell(cell);
    game.submit();
    vi.advanceTimersByTime(2000);

    expect(game.getState().round.gridSize).toBe(4);
  });

  it('clamps practice grid and pattern sizes', () => {
    const game = createGameController(settings);
    game.startPractice(2, 100);
    expect(game.getState().round.gridSize).toBe(MIN_GRID);
    expect(game.getState().round.patternSize).toBeLessThanOrEqual(MIN_GRID * MIN_GRID - 1);
  });

  it('toggles sound and reduced motion settings', () => {
    const game = createGameController(settings);
    expect(game.getState().soundEnabled).toBe(false);
    expect(game.toggleSound()).toBe(true);
    expect(game.getState().soundEnabled).toBe(true);

    expect(game.getState().reducedMotion).toBe(true);
    expect(game.toggleReducedMotion()).toBe(false);
    expect(game.getState().reducedMotion).toBe(false);
  });
});
