import type { GameMode, PersonalBest, Settings } from './types';

const BESTS_KEY = 'ekkorynd_bests_v1';
const SETTINGS_KEY = 'ekkorynd_settings_v1';

export const storage = {
  loadBests(): PersonalBest[] {
    try {
      const raw = localStorage.getItem(BESTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isPersonalBest);
    } catch {
      return [];
    }
  },

  saveBest(best: PersonalBest): void {
    const bests = this.loadBests();
    const existing = bests.findIndex(b => b.mode === best.mode);
    if (existing >= 0) {
      const current = bests[existing];
      if (best.score > current.score) {
        bests[existing] = best;
      }
    } else {
      bests.push(best);
    }
    try {
      localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
    } catch {
      // Private mode or quota exceeded. Score is not persisted.
    }
  },

  loadSettings(): Settings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaultSettings();
      const parsed = JSON.parse(raw);
      return {
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : false
      };
    } catch {
      return defaultSettings();
    }
  },

  saveSettings(settings: Settings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore write failures.
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(BESTS_KEY);
      localStorage.removeItem(SETTINGS_KEY);
    } catch {
      // Ignore.
    }
  }
};

function defaultSettings(): Settings {
  return { soundEnabled: true, reducedMotion: false };
}

function isPersonalBest(value: unknown): value is PersonalBest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    ['classic', 'practice', 'daily'].includes(v.mode as string) &&
    typeof v.score === 'number' &&
    typeof v.round === 'number' &&
    typeof v.achievedAt === 'string'
  );
}

export function formatBest(mode: GameMode, bests: PersonalBest[]): string {
  const best = bests.find(b => b.mode === mode);
  if (!best) return '—';
  return `${best.score.toLocaleString()} (R${best.round})`;
}
