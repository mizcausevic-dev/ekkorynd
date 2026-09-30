export interface AudioController {
  playReveal(): void;
  playSelect(): void;
  playSubmit(): void;
  playCorrect(): void;
  playWrong(): void;
  playRoundComplete(): void;
  playGameOver(): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

class WebAudioController implements AudioController {
  private ctx: AudioContext | null = null;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private context(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.1): void {
    const ctx = this.context();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  playReveal(): void {
    this.tone(440, 0.12, 'triangle', 0.08);
  }

  playSelect(): void {
    this.tone(880, 0.05, 'sine', 0.05);
  }

  playSubmit(): void {
    this.tone(660, 0.1, 'sine', 0.08);
  }

  playCorrect(): void {
    this.tone(523.25, 0.1, 'sine', 0.08);
    setTimeout(() => this.tone(783.99, 0.15, 'sine', 0.08), 80);
  }

  playWrong(): void {
    this.tone(200, 0.25, 'sawtooth', 0.06);
  }

  playRoundComplete(): void {
    this.tone(440, 0.08, 'triangle', 0.08);
    setTimeout(() => this.tone(554, 0.08, 'triangle', 0.08), 100);
    setTimeout(() => this.tone(659, 0.15, 'triangle', 0.08), 200);
  }

  playGameOver(): void {
    this.tone(392, 0.2, 'sawtooth', 0.08);
    setTimeout(() => this.tone(293.66, 0.35, 'sawtooth', 0.08), 180);
  }
}

export function createAudioController(): AudioController {
  return new WebAudioController();
}
