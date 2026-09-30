import type { GameMode, GameState, PersonalBest } from './types';
import { createGameController } from './game';
import { createRenderer, buildLastResult } from './renderer';

import { bindInput } from './input';
import { createAudioController } from './audio';
import { storage, formatBest } from './storage';
import './style.css';

const app = document.getElementById('app');
if (!app) throw new Error('App container not found');

const settings = storage.loadSettings();
const audio = createAudioController();
audio.setEnabled(settings.soundEnabled);

const game = createGameController(settings);
const renderer = createRenderer(app);

let bests = storage.loadBests();

function persistSettings(): void {
  const state = game.getState();
  storage.saveSettings({
    soundEnabled: state.soundEnabled,
    reducedMotion: state.reducedMotion
  });
}

function recordBestIfNeeded(): void {
  const state = game.getState();
  if (state.phase !== 'gameOver' && state.phase !== 'results') return;
  if (state.mode === 'practice') return;

  let roundNumber = state.round.roundNumber;
  // For classic, the failing round does not count as completed.
  if (state.mode === 'classic' && state.phase === 'gameOver') {
    roundNumber = Math.max(1, state.round.roundNumber - 1);
  }

  const best: PersonalBest = {
    mode: state.mode,
    score: state.totalScore,
    round: roundNumber,
    achievedAt: new Date().toISOString()
  };

  // Persist on game over for classic/daily.
  if (state.phase === 'gameOver' && (state.mode === 'classic' || state.mode === 'daily')) {
    storage.saveBest(best);
  }
  bests = storage.loadBests();
  updateHud(state);
}

game.onChange(() => {
  const state = game.getState();
  renderer.render(state, buildLastResult(state));
  updateHud(state);
  playPhaseSound(state);
  recordBestIfNeeded();
});

bindInput(game, renderer, audio, persistSettings);

// HUD.
const hud = document.createElement('div');
hud.className = 'hud';
app.appendChild(hud);

hud.innerHTML = `
  <div class="hud-left">
    <button id="btn-menu" class="hud-btn" aria-label="Open menu">☰</button>
    <span id="hud-mode" class="hud-label">CLASSIC</span>
    <span id="hud-round" class="hud-stat">R1</span>
  </div>
  <div class="hud-center">
    <span id="hud-score" class="hud-score">0</span>
  </div>
  <div class="hud-right">
    <button id="btn-sound" class="hud-btn" aria-label="Toggle sound">🔊</button>
    <button id="btn-motion" class="hud-btn" aria-label="Toggle reduced motion">✦</button>
    <button id="btn-help" class="hud-btn" aria-label="Instructions">?</button>
    <button id="btn-pause" class="hud-btn" aria-label="Pause">⏸</button>
  </div>
`;

const menuOverlay = document.createElement('div');
menuOverlay.className = 'overlay menu-overlay';
menuOverlay.innerHTML = `
  <div class="overlay-panel">
    <h1>Ekkorynd</h1>
    <p class="subtitle">Reconstruct the echo.</p>
    <div class="menu-grid">
      <button data-mode="classic" class="menu-choice primary">Classic</button>
      <button data-mode="daily" class="menu-choice">Daily Challenge</button>
      <button data-mode="practice" class="menu-choice">Practice</button>
    </div>
    <div class="practice-config" id="practice-config">
      <label>Grid size <input id="practice-grid" type="number" min="3" max="9" value="4"></label>
      <label>Pattern cells <input id="practice-pattern" type="number" min="1" max="80" value="5"></label>
      <button id="btn-practice-start" class="menu-choice primary">Start Practice</button>
    </div>
    <div class="bests">
      <div><span>Classic best</span><span id="best-classic">—</span></div>
      <div><span>Daily best</span><span id="best-daily">—</span></div>
    </div>
    <p class="privacy-note">Scores are stored locally in your browser. They are not cheat-resistant.</p>
    <button id="btn-close-menu" class="text-btn">Close</button>
  </div>
`;
app.appendChild(menuOverlay);

const instructionsOverlay = document.createElement('div');
instructionsOverlay.className = 'overlay instructions-overlay';
instructionsOverlay.innerHTML = `
  <div class="overlay-panel">
    <h2>How to play</h2>
    <ol>
      <li><strong>Memorize</strong>: A pattern of cells lights up briefly.</li>
      <li><strong>Recall</strong>: The pattern disappears. Select the cells you remember.</li>
      <li><strong>Submit</strong>: Press Enter or tap Submit when you are confident.</li>
      <li><strong>Results</strong>: Correct cells glow green, missed cells yellow, false selections red.</li>
    </ol>
    <h3>Controls</h3>
    <ul>
      <li><strong>Mouse / touch</strong>: Tap cells.</li>
      <li><strong>Keyboard</strong>: Arrow keys or WASD to move, Space/Enter to select, Enter to submit.</li>
      <li><strong>P / Esc</strong>: Pause. <strong>R</strong>: Restart. <strong>M</strong>: Mute. <strong>H</strong>: Help.</li>
    </ul>
    <h3>Scoring</h3>
    <p>Each round: <code>(correct / patternSize) × 1000 − missed × 50 − false × 100</code>. Perfect rounds earn a +100 bonus.</p>
    <p>Classic mode ends when you recall fewer than half the pattern.</p>
    <button id="btn-close-instructions" class="text-btn">Got it</button>
  </div>
`;
app.appendChild(instructionsOverlay);

// Submit button for touch/mouse users during recall.
const submitButton = document.createElement('button');
submitButton.className = 'submit-btn';
submitButton.textContent = 'Submit';
submitButton.addEventListener('click', () => game.submit());
app.appendChild(submitButton);

// Event wiring.
document.getElementById('btn-menu')!.addEventListener('click', () => showMenu());
document.getElementById('btn-close-menu')!.addEventListener('click', () => hideMenu());
document.getElementById('btn-sound')!.addEventListener('click', () => {
  const enabled = game.toggleSound();
  persistSettings();
  if (enabled) audio.playSelect();
  updateHud(game.getState());
});
document.getElementById('btn-motion')!.addEventListener('click', () => {
  game.toggleReducedMotion();
  persistSettings();
  updateHud(game.getState());
});
document.getElementById('btn-help')!.addEventListener('click', () => game.showInstructions());
document.getElementById('btn-pause')!.addEventListener('click', () => game.pause());
document.getElementById('btn-close-instructions')!.addEventListener('click', () => game.hideInstructions());

document.querySelectorAll('.menu-choice[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = (btn as HTMLElement).dataset.mode as GameMode;
    if (mode === 'classic') {
      game.startClassic();
      hideMenu();
    } else if (mode === 'daily') {
      game.startDaily(new Date());
      hideMenu();
    } else if (mode === 'practice') {
      const config = document.getElementById('practice-config')!;
      config.classList.add('open');
    }
  });
});

document.getElementById('btn-practice-start')!.addEventListener('click', () => {
  const grid = parseInt((document.getElementById('practice-grid') as HTMLInputElement).value, 10);
  const pattern = parseInt((document.getElementById('practice-pattern') as HTMLInputElement).value, 10);
  game.startPractice(grid, pattern);
  hideMenu();
});

function showMenu(): void {
  menuOverlay.classList.add('open');
  document.getElementById('best-classic')!.textContent = formatBest('classic', bests);
  document.getElementById('best-daily')!.textContent = formatBest('daily', bests);
}

function hideMenu(): void {
  menuOverlay.classList.remove('open');
  document.getElementById('practice-config')!.classList.remove('open');
}

function updateHud(state: GameState): void {
  document.getElementById('hud-mode')!.textContent = state.mode.toUpperCase();
  document.getElementById('hud-round')!.textContent = `R${state.round.roundNumber}`;
  document.getElementById('hud-score')!.textContent = state.totalScore.toLocaleString();
  document.getElementById('btn-sound')!.textContent = state.soundEnabled ? '🔊' : '🔇';
  document.getElementById('btn-motion')!.textContent = state.reducedMotion ? '◈' : '✦';

  const pausedOrInstructions = state.phase === 'paused' || state.phase === 'instructions';
  instructionsOverlay.classList.toggle('open', pausedOrInstructions);

  const showSubmit = state.phase === 'recall';
  submitButton.classList.toggle('visible', showSubmit);

  // Update menu bests whenever HUD refreshes.
  if (menuOverlay.classList.contains('open')) {
    document.getElementById('best-classic')!.textContent = formatBest('classic', bests);
    document.getElementById('best-daily')!.textContent = formatBest('daily', bests);
  }
}

function playPhaseSound(state: GameState): void {
  if (!audio.isEnabled()) return;
  if (state.phase === 'reveal') audio.playReveal();
  if (state.phase === 'results') {
    const last = state.results[state.results.length - 1];
    if (last) {
      if (last.perfect) audio.playRoundComplete();
      else if (last.falsePositive > 0 || last.missed > 0) audio.playCorrect();
    }
  }
  if (state.phase === 'gameOver') audio.playGameOver();
}

// Initial render.
showMenu();
renderer.render(game.getState(), null);

// Prevent context menu on long press.
window.addEventListener('contextmenu', e => {
  if ((e.target as Node)?.nodeName === 'CANVAS') e.preventDefault();
});
