# Ekkorynd

An original spatial-memory browser game. Reconstruct a briefly illuminated pattern on a grid.

> Working title: Echo Grid

## Product behavior

- **Reveal**: a pattern of grid cells lights up for a short, documented time.
- **Recall**: the pattern disappears. Select the cells you remember.
- **Submit**: press Enter or tap Submit.
- **Results**: the game shows correct cells (green), missed cells (yellow), and false selections (red), then advances to the next round.

The solution is never encoded in visible UI during recall. Grid size and pattern complexity increase across rounds.

## Modes

- **Classic**: continuous rounds. Grid and pattern grow automatically. The run ends when you recall fewer than half the pattern.
- **Daily Challenge**: a fixed seed derived from the calendar date. Same pattern for everyone each day. Runs for 10 rounds.
- **Practice**: configurable grid size and pattern count. Scores are not saved to personal bests.

## Scoring formula

For each round:

```
roundScore = max(0, round(
  (correct / patternSize) × 1000
  − missed × 50
  − falsePositive × 100
))
```

A perfect round (no misses, no false positives) adds a **+100 bonus**.

`totalScore` is the sum of all `roundScore` values.

## Controls

- **Mouse / touch**: tap cells. Tap Submit when ready.
- **Keyboard**: Arrow keys or WASD move focus. Space/Enter selects the focused cell. Enter also submits.
- **P / Esc**: pause or resume.
- **R**: restart.
- **M**: toggle sound.
- **H / ?**: show instructions.

## Accessibility

- **Reduced motion**: disables animated glows and shortens transition delays.
- **Keyboard navigation**: full grid control without a pointer device.
- **Sound toggle**: all audio is generated with the Web Audio API; no external assets.

## Privacy note

Scores and settings are stored in `localStorage` on your device only. They are **not cheat-resistant** and are not synced to any server.

## Setup

```bash
npm install
npm run dev      # local development server
npm run test     # deterministic unit tests
npm run build    # production bundle in dist/
npm run preview  # preview production build
```

## Project structure

```
src/
  main.ts          # entry point, UI wiring, HUD
  game.ts          # state machine, round generation, pattern generation
  scoring.ts       # documented scoring formula
  renderer.ts      # Canvas rendering
  input.ts         # mouse, touch, keyboard input
  audio.ts         # Web Audio API sound generation
  storage.ts       # localStorage personal bests and settings
  types.ts         # shared TypeScript types
  utils.ts         # deterministic RNG helpers
  __tests__/       # Vitest tests
```

## Deployment

### Static host (Hostinger canonical)

Build first, then upload only the `dist/` contents. Replace `<domain>` with the target property.

```powershell
npm run build
$domain = "<domain>"
$dest = "u815783393@82.25.89.47:~/domains/$domain/public_html/"
tar -czf - -C dist . | ssh -p 65002 u815783393@82.25.89.47 "cd ~/domains/$domain/public_html && tar --overwrite -xzf -"
```

For estate properties, run `deploy_guard.py --preflight` and `--verify` before uploading. Do not chain a remote delete step onto the upload.

### Netlify / Vercel (alternatives)

```bash
npx netlify deploy --dir=dist --prod
# or
npx vercel --prod dist
```

## Human-verification checklist

- [ ] `npm run build` completes without TypeScript errors.
- [ ] `npm run test` passes all tests.
- [ ] `npm run preview` loads the menu and starts Classic mode.
- [ ] Reveal phase shows a pattern; cells turn blank after the timer.
- [ ] Recall phase allows selecting and deselecting cells.
- [ ] Submit shows results with green/yellow/red cells.
- [ ] A failed classic round shows "ECHO FADED" and allows restart.
- [ ] Daily Challenge produces the same pattern on two fresh browser sessions today.
- [ ] Practice mode respects the configured grid size across rounds.
- [ ] Sound toggle and reduced-motion toggle persist after reload.
- [ ] Keyboard navigation (arrow keys, space, enter) works.
- [ ] Touch selection works on a mobile device or emulator.
- [ ] `localStorage` discloses that scores are local and not cheat-resistant.

## License

Original work. No reproduction of another game's branding, proprietary code, assets, or exact visuals.
