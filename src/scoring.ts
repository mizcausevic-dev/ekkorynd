import type { CellCoord, RoundResult, RoundSpec } from './types';
import { coordKey, sameCoord } from './utils';

/**
 * Ekkorynd scoring formula.
 *
 * For each round:
 *   correct       = selected cells that were in the pattern
 *   missed        = pattern cells that were not selected
 *   falsePositive = selected cells that were not in the pattern
 *   patternSize   = total cells in the revealed pattern
 *
 * roundScore = max(0, round(
 *   (correct / patternSize) * 1000
 *   - missed * 50
 *   - falsePositive * 100
 * ))
 *
 * Perfect round bonus: +100 if missed === 0 and falsePositive === 0.
 *
 * totalScore = sum of all roundScore values.
 *
 * The formula rewards recall accuracy and penalizes guesses more heavily than
 * omissions. A round with no correct selections scores 0.
 */
export interface ScoreBreakdown {
  readonly correct: number;
  readonly missed: number;
  readonly falsePositive: number;
  readonly accuracy: number;
  readonly roundScore: number;
  readonly perfect: boolean;
}

export function computeScore(
  pattern: readonly CellCoord[],
  selected: readonly CellCoord[]
): ScoreBreakdown {
  const patternSet = new Set(pattern.map(coordKey));
  const selectedSet = new Set(selected.map(coordKey));

  let correct = 0;
  for (const c of selected) {
    if (patternSet.has(coordKey(c))) correct += 1;
  }

  const missed = pattern.length - correct;
  const falsePositive = selected.length - correct;

  const accuracy = pattern.length > 0 ? correct / pattern.length : 0;
  let roundScore = 0;
  if (pattern.length > 0) {
    roundScore = Math.round(accuracy * 1000 - missed * 50 - falsePositive * 100);
  }
  roundScore = Math.max(0, roundScore);

  const perfect = missed === 0 && falsePositive === 0 && pattern.length > 0;
  if (perfect) roundScore += 100;

  return {
    correct,
    missed,
    falsePositive,
    accuracy,
    roundScore,
    perfect
  };
}

export function buildRoundResult(
  round: RoundSpec,
  pattern: readonly CellCoord[],
  selected: readonly CellCoord[]
): RoundResult {
  const score = computeScore(pattern, selected);
  return {
    roundNumber: round.roundNumber,
    gridSize: round.gridSize,
    pattern,
    selected,
    correct: score.correct,
    missed: score.missed,
    falsePositive: score.falsePositive,
    roundScore: score.roundScore,
    perfect: score.perfect
  };
}

/** Classic mode fails if the player recalls fewer than half the pattern. */
export function isRoundFailure(result: RoundResult): boolean {
  return result.pattern.length > 0 && result.correct / result.pattern.length < 0.5;
}
