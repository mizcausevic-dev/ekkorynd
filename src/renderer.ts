import type { CellCoord, GameState, Rect } from './types';

interface Theme {
  bg: string;
  panel: string;
  gridLine: string;
  cellBase: string;
  cellHover: string;
  cellFocus: string;
  cellSelected: string;
  cellPattern: string;
  cellCorrect: string;
  cellMissed: string;
  cellFalse: string;
  text: string;
  textMuted: string;
  accent: string;
  accentGlow: string;
}

const theme: Theme = {
  bg: '#0B0C10',
  panel: '#1F2833',
  gridLine: 'rgba(197, 198, 199, 0.12)',
  cellBase: '#1F2833',
  cellHover: 'rgba(102, 252, 241, 0.12)',
  cellFocus: 'rgba(102, 252, 241, 0.35)',
  cellSelected: 'rgba(102, 252, 241, 0.55)',
  cellPattern: '#66FCF1',
  cellCorrect: '#2FD57A',
  cellMissed: '#D6FF3F',
  cellFalse: '#FF2D55',
  text: '#C5C6C7',
  textMuted: '#8b8d90',
  accent: '#66FCF1',
  accentGlow: 'rgba(102, 252, 241, 0.6)'
};

export interface Renderer {
  resize(): void;
  render(state: GameState, lastResult: LastResult | null): void;
  pickCell(clientX: number, clientY: number): CellCoord | null;
  canvas: HTMLCanvasElement;
}

export interface LastResult {
  pattern: readonly CellCoord[];
  selected: readonly CellCoord[];
}

export function buildLastResult(state: { results: readonly { pattern: readonly CellCoord[]; selected: readonly CellCoord[] }[] }): LastResult | null {
  const last = state.results[state.results.length - 1];
  return last ? { pattern: last.pattern, selected: last.selected } : null;
}

export function createRenderer(container: HTMLElement): Renderer {
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);

  const ctxRaw = canvas.getContext('2d');
  if (!ctxRaw) throw new Error('Canvas 2D context not available');
  const ctx = ctxRaw;

  let layout: GridLayout | null = null;
  let dpr = window.devicePixelRatio || 1;

  function resize(): void {
    dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function computeLayout(gridSize: number): GridLayout {
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const minDim = Math.min(width, height);
    // Reserve margins for HUD and safe area.
    const maxGrid = Math.min(minDim - 32, Math.min(width, height * 0.85));
    const cellGap = Math.max(2, Math.floor(maxGrid / (gridSize * 24)));
    const cellSize = Math.floor((maxGrid - cellGap * (gridSize + 1)) / gridSize);
    const gridPx = cellSize * gridSize + cellGap * (gridSize + 1);
    const x = Math.floor((width - gridPx) / 2);
    const y = Math.floor((height - gridPx) / 2) + 18;
    return { x, y, cellSize, cellGap, gridSize, gridPx };
  }

  function cellRect(layout: GridLayout, cell: CellCoord): Rect {
    const x = layout.x + layout.cellGap + cell.col * (layout.cellSize + layout.cellGap);
    const y = layout.y + layout.cellGap + cell.row * (layout.cellSize + layout.cellGap);
    return { x, y, width: layout.cellSize, height: layout.cellSize };
  }

  function render(state: GameState, lastResult: LastResult | null): void {
    const rect = container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Background.
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Ambient grid texture.
    drawAmbientGrid(rect.width, rect.height);

    layout = computeLayout(state.round.gridSize);

    // Draw title in idle/instructions.
    if (state.phase === 'idle' || state.phase === 'instructions') {
      drawTitle(rect.width, layout.y - 24);
    }

    // Draw grid background.
    ctx.fillStyle = theme.panel;
    roundRect(ctx, layout.x, layout.y, layout.gridPx, layout.gridPx, 12);
    ctx.fill();

    const patternSet = new Set(state.pattern.map(c => `${c.row},${c.col}`));
    const selectedSet = new Set(state.selected.map(c => `${c.row},${c.col}`));

    for (let row = 0; row < state.round.gridSize; row++) {
      for (let col = 0; col < state.round.gridSize; col++) {
        const cell = { row, col };
        const r = cellRect(layout, cell);
        const key = `${row},${col}`;
        const isPattern = patternSet.has(key);
        const isSelected = selectedSet.has(key);
        const isFocused = state.focusedCell && state.focusedCell.row === row && state.focusedCell.col === col;

        let fill = theme.cellBase;
        let glow = false;

        if (state.phase === 'reveal' && isPattern) {
          fill = theme.cellPattern;
          glow = !state.reducedMotion;
        } else if (state.phase === 'recall' && isSelected) {
          fill = theme.cellSelected;
        } else if (state.phase === 'results' && lastResult) {
          const inPattern = lastResult.pattern.some(c => c.row === row && c.col === col);
          const inSelected = lastResult.selected.some(c => c.row === row && c.col === col);
          if (inPattern && inSelected) fill = theme.cellCorrect;
          else if (inPattern && !inSelected) fill = theme.cellMissed;
          else if (!inPattern && inSelected) fill = theme.cellFalse;
        }

        if (state.phase === 'recall' && isFocused) {
          ctx.save();
          ctx.shadowColor = theme.accentGlow;
          ctx.shadowBlur = 12;
          ctx.strokeStyle = theme.accent;
          ctx.lineWidth = 2;
          roundRect(ctx, r.x - 2, r.y - 2, r.width + 4, r.height + 4, 6);
          ctx.stroke();
          ctx.restore();
        }

        if (glow) {
          ctx.save();
          ctx.shadowColor = theme.accentGlow;
          ctx.shadowBlur = 22;
          ctx.fillStyle = fill;
          roundRect(ctx, r.x, r.y, r.width, r.height, 6);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = fill;
          roundRect(ctx, r.x, r.y, r.width, r.height, 6);
          ctx.fill();
        }

        // Hover hint during recall.
        if (state.phase === 'recall' && isFocused && !isSelected) {
          ctx.fillStyle = theme.cellHover;
          roundRect(ctx, r.x, r.y, r.width, r.height, 6);
          ctx.fill();
        }
      }
    }

    drawPhaseOverlay(state, rect.width, rect.height, layout);
  }

  function drawAmbientGrid(w: number, h: number): void {
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    const step = 44;
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  function drawTitle(w: number, y: number): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = theme.accent;
    ctx.font = '700 42px "Space Grotesk", sans-serif';
    ctx.fillText('EKKORYND', w / 2, y);
    ctx.fillStyle = theme.textMuted;
    ctx.font = '400 16px "Space Grotesk", sans-serif';
    ctx.fillText('Spatial memory. Reconstruct the echo.', w / 2, y + 24);
    ctx.restore();
  }

  function drawPhaseOverlay(state: GameState, w: number, h: number, layout: GridLayout): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.phase === 'reveal') {
      ctx.fillStyle = 'rgba(11, 12, 16, 0.65)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = theme.accent;
      ctx.font = '700 24px "Space Grotesk", sans-serif';
      ctx.fillText('MEMORIZE', w / 2, layout.y - 28);
    } else if (state.phase === 'recall') {
      ctx.fillStyle = theme.accent;
      ctx.font = '700 24px "Space Grotesk", sans-serif';
      ctx.fillText('RECALL', w / 2, layout.y - 28);
    } else if (state.phase === 'results') {
      const last = state.results[state.results.length - 1];
      if (last) {
        ctx.fillStyle = 'rgba(11, 12, 16, 0.55)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = theme.text;
        ctx.font = '700 22px "Space Grotesk", sans-serif';
        const label = last.perfect ? 'PERFECT' : `${last.correct}/${last.pattern.length} correct`;
        ctx.fillText(label, w / 2, layout.y - 36);
        ctx.font = '400 14px "Space Grotesk", sans-serif';
        ctx.fillStyle = theme.textMuted;
        ctx.fillText(`+${last.roundScore.toLocaleString()} pts`, w / 2, layout.y - 16);
      }
    } else if (state.phase === 'paused') {
      ctx.fillStyle = 'rgba(11, 12, 16, 0.85)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = theme.text;
      ctx.font = '700 28px "Space Grotesk", sans-serif';
      ctx.fillText('PAUSED', w / 2, h / 2 - 12);
      ctx.fillStyle = theme.textMuted;
      ctx.font = '400 14px "Space Grotesk", sans-serif';
      ctx.fillText('Press ESC or P to resume', w / 2, h / 2 + 16);
    } else if (state.phase === 'gameOver') {
      ctx.fillStyle = 'rgba(11, 12, 16, 0.9)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = theme.text;
      ctx.font = '700 32px "Space Grotesk", sans-serif';
      ctx.fillText('ECHO FADED', w / 2, h / 2 - 28);
      ctx.font = '400 18px "Space Grotesk", sans-serif';
      ctx.fillStyle = theme.accent;
      ctx.fillText(`Score ${state.totalScore.toLocaleString()}`, w / 2, h / 2 + 8);
      ctx.fillStyle = theme.textMuted;
      ctx.font = '400 14px "Space Grotesk", sans-serif';
      ctx.fillText('Press R to restart', w / 2, h / 2 + 36);
    }

    ctx.restore();
  }

  function pickCell(clientX: number, clientY: number): CellCoord | null {
    if (!layout) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - layout.x;
    const y = clientY - rect.top - layout.y;
    if (x < 0 || y < 0 || x > layout.gridPx || y > layout.gridPx) return null;
    const col = Math.floor(x / (layout.cellSize + layout.cellGap));
    const row = Math.floor(y / (layout.cellSize + layout.cellGap));
    if (col < 0 || row < 0 || col >= layout.gridSize || row >= layout.gridSize) return null;
    // Ensure click is inside the cell, not in the gap.
    const r = cellRect(layout, { row, col });
    if (x < r.x - layout.x || x > r.x - layout.x + r.width) return null;
    if (y < r.y - layout.y || y > r.y - layout.y + r.height) return null;
    return { row, col };
  }

  resize();

  return { resize, render, pickCell, canvas };
}

interface GridLayout {
  x: number;
  y: number;
  cellSize: number;
  cellGap: number;
  gridSize: number;
  gridPx: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
