export type Phase = 'idle' | 'reveal' | 'recall' | 'results' | 'paused' | 'gameOver' | 'instructions';

export type GameMode = 'classic' | 'practice' | 'daily';

export interface CellCoord {
  readonly row: number;
  readonly col: number;
}

export interface RoundSpec {
  readonly roundNumber: number;
  readonly gridSize: number;
  readonly patternSize: number;
  readonly revealMs: number;
}

export interface RoundResult {
  readonly roundNumber: number;
  readonly gridSize: number;
  readonly pattern: readonly CellCoord[];
  readonly selected: readonly CellCoord[];
  readonly correct: number;
  readonly missed: number;
  readonly falsePositive: number;
  readonly roundScore: number;
  readonly perfect: boolean;
}

export interface GameState {
  readonly mode: GameMode;
  readonly phase: Phase;
  readonly round: RoundSpec;
  readonly pattern: readonly CellCoord[];
  readonly selected: readonly CellCoord[];
  readonly results: readonly RoundResult[];
  readonly totalScore: number;
  readonly soundEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly focusedCell: CellCoord | null;
  readonly seed: number;
  readonly dailyDate?: string;
  readonly practiceGridSize?: number;
  readonly practicePatternSize?: number;
}

export interface PersonalBest {
  readonly mode: GameMode;
  readonly score: number;
  readonly round: number;
  readonly achievedAt: string;
}

export interface Settings {
  readonly soundEnabled: boolean;
  readonly reducedMotion: boolean;
}

export interface DailyConfig {
  readonly date: string;
  readonly seed: number;
  readonly rounds: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
