import type { CellCoord, GameMode, GameState, Phase, RoundResult, RoundSpec, Settings } from './types';
import { SeededRandom, sameCoord } from './utils';
import { buildRoundResult, isRoundFailure } from './scoring';

export const MIN_GRID = 3;
export const MAX_GRID = 9;
export const REVEAL_BASE_MS = 1200;
export const REVEAL_PER_CELL_MS = 180;

/** Build the spec for a given round. Grid and pattern size grow with the round. */
export function buildRound(roundNumber: number): RoundSpec {
  const gridSize = Math.min(MAX_GRID, MIN_GRID + Math.floor((roundNumber - 1) / 3));
  // Pattern size grows slower than grid capacity to keep it fair.
  const patternSize = Math.min(gridSize * gridSize - 1, 2 + roundNumber);
  const revealMs = REVEAL_BASE_MS + patternSize * REVEAL_PER_CELL_MS;
  return { roundNumber, gridSize, patternSize, revealMs };
}

/** Generate a random pattern of unique cells for a round. */
export function generatePattern(gridSize: number, patternSize: number, rng: SeededRandom): CellCoord[] {
  const count = Math.min(patternSize, gridSize * gridSize);
  const indices: number[] = [];
  const available = Array.from({ length: gridSize * gridSize }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const idx = rng.nextInt(0, available.length);
    indices.push(available[idx]);
    available.splice(idx, 1);
  }
  return indices
    .map(index => ({ row: Math.floor(index / gridSize), col: index % gridSize }))
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Seed for a daily challenge derived from calendar date. */
export function dailySeed(date: Date): number {
  const iso = date.toISOString().slice(0, 10);
  let h = 2166136261;
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface GameController {
  getState(): GameState;
  startClassic(): void;
  startPractice(gridSize: number, patternSize: number): void;
  startDaily(date: Date): void;
  toggleCell(cell: CellCoord): void;
  moveFocus(direction: 'up' | 'down' | 'left' | 'right'): void;
  submit(): void;
  nextRound(): void;
  restart(): void;
  pause(): void;
  resume(): void;
  toggleSound(): boolean;
  toggleReducedMotion(): boolean;
  showInstructions(): void;
  hideInstructions(): void;
  onChange(callback: () => void): void;
  offChange(callback: () => void): void;
}

export function createGameController(initialSettings: Settings): GameController {
  let settings = { ...initialSettings };
  let state = buildInitialState(settings, 'classic');
  const listeners = new Set<() => void>();

  function emit(): void {
    for (const cb of listeners) cb();
  }

  function startRound(): void {
    const round = state.round;
    const rng = new SeededRandom(state.seed + round.roundNumber);
    const pattern = generatePattern(round.gridSize, round.patternSize, rng);
    state = {
      ...state,
      pattern,
      selected: [],
      focusedCell: { row: Math.floor(round.gridSize / 2), col: Math.floor(round.gridSize / 2) },
      phase: 'reveal'
    };
    emit();
    const revealMs = state.reducedMotion ? round.revealMs + 300 : round.revealMs;
    setTimeout(() => {
      if (state.phase === 'reveal') {
        state = { ...state, phase: 'recall' };
        emit();
      }
    }, revealMs);
  }

  function transitionToNextRoundOrEnd(result: RoundResult): void {
    if (state.mode === 'classic' && isRoundFailure(result)) {
      state = { ...state, phase: 'gameOver' };
      emit();
      return;
    }
    if (state.mode === 'daily' && state.round.roundNumber >= 10) {
      state = { ...state, phase: 'gameOver' };
      emit();
      return;
    }

    const nextRoundNumber = state.round.roundNumber + 1;
    let nextRound: RoundSpec;
    if (state.mode === 'practice' && state.practiceGridSize && state.practicePatternSize) {
      nextRound = {
        roundNumber: nextRoundNumber,
        gridSize: state.practiceGridSize,
        patternSize: state.practicePatternSize,
        revealMs: REVEAL_BASE_MS + state.practicePatternSize * REVEAL_PER_CELL_MS
      };
    } else {
      nextRound = buildRound(nextRoundNumber);
    }
    state = { ...state, round: nextRound };
    startRound();
  }

  const controller: GameController = {
    getState: () => state,

    startClassic: () => {
      state = buildInitialState(settings, 'classic');
      startRound();
    },

    startPractice: (gridSize: number, patternSize: number) => {
      const clampedGrid = Math.max(MIN_GRID, Math.min(MAX_GRID, gridSize));
      const clampedPattern = Math.max(1, Math.min(clampedGrid * clampedGrid - 1, patternSize));
      state = {
        ...buildInitialState(settings, 'practice'),
        practiceGridSize: clampedGrid,
        practicePatternSize: clampedPattern,
        round: {
          roundNumber: 1,
          gridSize: clampedGrid,
          patternSize: clampedPattern,
          revealMs: REVEAL_BASE_MS + clampedPattern * REVEAL_PER_CELL_MS
        }
      };
      startRound();
    },

    startDaily: (date: Date) => {
      state = {
        ...buildInitialState(settings, 'daily'),
        seed: dailySeed(date),
        dailyDate: date.toISOString().slice(0, 10),
        round: buildRound(1)
      };
      startRound();
    },

    toggleCell: (cell: CellCoord) => {
      if (state.phase !== 'recall') return;
      const exists = state.selected.some(c => sameCoord(c, cell));
      const selected = exists
        ? state.selected.filter(c => !sameCoord(c, cell))
        : [...state.selected, cell];
      state = { ...state, selected, focusedCell: cell };
      emit();
    },

    moveFocus: (direction: 'up' | 'down' | 'left' | 'right'): void => {
      const current = state.focusedCell ?? { row: 0, col: 0 };
      const size = state.round.gridSize;
      let next = { ...current };
      if (direction === 'up') next.row = Math.max(0, next.row - 1);
      if (direction === 'down') next.row = Math.min(size - 1, next.row + 1);
      if (direction === 'left') next.col = Math.max(0, next.col - 1);
      if (direction === 'right') next.col = Math.min(size - 1, next.col + 1);
      state = { ...state, focusedCell: next };
      emit();
    },

    submit: () => {
      if (state.phase !== 'recall') return;
      const result = buildRoundResult(state.round, state.pattern, state.selected);
      const totalScore = state.totalScore + result.roundScore;
      state = { ...state, phase: 'results', results: [...state.results, result], totalScore };
      emit();
      const delay = state.reducedMotion ? 1200 : 1600;
      setTimeout(() => transitionToNextRoundOrEnd(result), delay);
    },

    nextRound: () => {
      if (state.phase !== 'results') return;
      const last = state.results[state.results.length - 1];
      if (!last) return;
      transitionToNextRoundOrEnd(last);
    },

    restart: () => {
      if (state.mode === 'practice' && state.practiceGridSize && state.practicePatternSize) {
        controller.startPractice(state.practiceGridSize, state.practicePatternSize);
        return;
      }
      if (state.mode === 'daily' && state.dailyDate) {
        controller.startDaily(new Date(state.dailyDate));
        return;
      }
      controller.startClassic();
    },

    pause: () => {
      if (state.phase === 'reveal' || state.phase === 'recall') {
        state = { ...state, phase: 'paused' };
        emit();
      }
    },

    resume: () => {
      if (state.phase !== 'paused') return;
      state = { ...state, phase: 'recall' };
      emit();
    },

    toggleSound: () => {
      settings = { ...settings, soundEnabled: !settings.soundEnabled };
      state = { ...state, soundEnabled: settings.soundEnabled };
      emit();
      return settings.soundEnabled;
    },

    toggleReducedMotion: () => {
      settings = { ...settings, reducedMotion: !settings.reducedMotion };
      state = { ...state, reducedMotion: settings.reducedMotion };
      emit();
      return settings.reducedMotion;
    },

    showInstructions: () => {
      if (state.phase === 'reveal' || state.phase === 'recall') {
        state = { ...state, phase: 'paused' };
      } else if (state.phase !== 'gameOver') {
        state = { ...state, phase: 'instructions' };
      }
      emit();
    },

    hideInstructions: () => {
      if (state.phase === 'paused') {
        state = { ...state, phase: 'recall' };
      } else if (state.phase === 'instructions') {
        state = { ...state, phase: 'idle' };
      }
      emit();
    },

    onChange: (cb: () => void) => {
      listeners.add(cb);
    },

    offChange: (cb: () => void) => {
      listeners.delete(cb);
    }
  };

  return controller;
}

function buildInitialState(settings: Settings, mode: 'classic' | 'practice' | 'daily'): GameState {
  return {
    mode,
    phase: 'idle',
    round: buildRound(1),
    pattern: [],
    selected: [],
    results: [],
    totalScore: 0,
    soundEnabled: settings.soundEnabled,
    reducedMotion: settings.reducedMotion,
    focusedCell: null,
    seed: Math.floor(Math.random() * 2 ** 32),
    practiceGridSize: undefined,
    practicePatternSize: undefined,
    dailyDate: undefined
  };
}
