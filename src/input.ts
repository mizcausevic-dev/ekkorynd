import type { GameController } from './game';
import type { CellCoord } from './types';
import type { Renderer } from './renderer';
import { buildLastResult } from './renderer';
import type { AudioController } from './audio';

export function bindInput(
  controller: GameController,
  renderer: Renderer,
  audio: AudioController,
  saveSettings: () => void
): void {
  const canvas = renderer.canvas;

  function handlePointer(clientX: number, clientY: number): void {
    const cell = renderer.pickCell(clientX, clientY);
    if (cell) {
      controller.toggleCell(cell);
      if (audio.isEnabled()) audio.playSelect();
    }
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    handlePointer(e.clientX, e.clientY);
  }, { passive: false });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handlePointer(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });

  window.addEventListener('keydown', e => {
    // Global shortcuts.
    if (e.key === 'm' || e.key === 'M') {
      const enabled = controller.toggleSound();
      saveSettings();
      if (enabled) audio.playSelect();
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      controller.restart();
      return;
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      const state = controller.getState();
      if (state.phase === 'paused') controller.resume();
      else controller.pause();
      return;
    }
    if (e.key === '?' || e.key === 'h' || e.key === 'H') {
      const state = controller.getState();
      if (state.phase === 'instructions' || state.phase === 'paused') controller.hideInstructions();
      else controller.showInstructions();
      return;
    }

    // Grid navigation and selection only during recall.
    const state = controller.getState();
    if (state.phase !== 'recall') return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        controller.moveFocus('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        controller.moveFocus('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        controller.moveFocus('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        controller.moveFocus('right');
        break;
      case ' ':
      case 'Enter':
        if (state.focusedCell) {
          controller.toggleCell(state.focusedCell);
          if (audio.isEnabled()) audio.playSelect();
        }
        break;
      case 'Backspace':
        // Remove most recent selection for accessibility.
        if (state.selected.length > 0) {
          const last = state.selected[state.selected.length - 1];
          controller.toggleCell(last);
        }
        break;
      default:
        return;
    }
  });

  window.addEventListener('resize', () => {
    renderer.resize();
    renderer.render(controller.getState(), buildLastResult(controller.getState()));
  });
}

