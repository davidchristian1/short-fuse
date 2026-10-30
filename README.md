# Short Fuse

An original endless bomb-sorting arcade game for the browser. Drag each toy bomb into the matching factory bin before its fuse burns out. Fill a bin to ship a batch, survive as long as you can, and chase a high score.

Inspired by the *feel* of sorting-and-fuse minigames, with original characters, factory art, UI, and sound. No Nintendo characters or extracted assets.

Change the title in `src/config/gameConfig.ts` (`GAME_CONFIG.title`) and every screen follows.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default [http://localhost:5173](http://localhost:5173)).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local game |
| `npm test` | Run unit tests (sorting, fuse, chain reaction, difficulty, scoring) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run assets` | Regenerate SVG artwork and fuse-tip metadata |
| `npm run assets:bg` | Resize factory-floor paintings into `public/assets/bg` |

Query flags for QA:

- `?play` — skip the menu and start a run
- `?level=18` — start at a given level
- `?debug` — extra keys: `1–4` spawn a category, `L` level up, `[` / `]` jump levels

## How to play

1. Bombs walk out of the factory doors onto the sorting floor.
2. Drag a bomb (mouse, touch, or pen) into the bin that shares its **color, emblem, and silhouette**.
3. Fuses keep burning while you drag. An expired fuse or a wrong bin ends the run.
4. A bin that reaches **40** safe bombs ships them, banks the points, and clears.
5. Difficulty never hits a final level: a second door, then Aqua, then Moss, then special bombs, then endless escalation.

**Controls:** drag to sort · `Esc` pause · `M` mute · `F` fullscreen · `Enter` play / resume.

## Scoring

- Shipped batches (40 at a time) are secured forever.
- Pending bombs in bins that did **not** explode count as survivors at game over.
- Pending bombs in the detonated bin are lost.
- Unsorted floor bombs do not count.
- Bonus bombs add extra points only when sorted correctly.
- Best score is stored in `localStorage` under `short-fuse:best`.

## Project layout

```
src/
  config/          Title, rules, categories
  logic/           Session, bombs, difficulty, spawn, movement, scoring
  game/            Phaser boot, menu, playfield, sprites
  audio/           Web Audio synthesizer (no sound files)
  ui/              HTML menus, pause, game over
  storage/         High score and settings
public/assets/
  svg/             Original bomb, door, zone, explosion, and UI art
  bg/              Factory floor paintings
scripts/           SVG generator and background processor
tests/             Vitest coverage of the rules above
```

## Generated assets

Artwork is original vector illustration produced by `scripts/generate-svg-assets.mjs` (not emoji, not remote URLs, not Nintendo sprites). Factory-floor paintings live in `art-source/generated/` and are resized into `public/assets/bg/`.

| Asset | Location |
| --- | --- |
| Ember / Midnight / Aqua / Moss bombs (idle, walk, blink, drag, panic, happy) | `public/assets/svg/bomb_*.svg` |
| Category emblems and sorting-zone frames | `public/assets/svg/emblem_*.svg`, `zone_*.svg` |
| Entry doors (open / closed / locked) | `public/assets/svg/door_*.svg` |
| Cartoon explosions, sparks, debris | `public/assets/svg/explosion_*.svg`, `spark_*.svg`, `debris_*.svg` |
| Special-bomb badges | `public/assets/svg/badge_*.svg` |
| UI icons, title burst, game-over art | `public/assets/svg/icon_*.svg`, `title_burst.svg`, `gameover_bomb.svg` |
| Factory floors | `public/assets/bg/factory_floor_landscape.jpg`, `factory_floor_portrait.jpg` |
| Fuse-tip metadata | `src/assets/bombMeta.json` |

Sound effects are synthesized at runtime with the Web Audio API (`src/audio/AudioManager.ts`): spawn, pickup, sort chimes, fuse ticks, cartoon explosion, chain pops, collection flourish, level-up, game over, and new high score. There are no audio files and no remote audio servers.

## Features

- Endless survival run: levels keep going past 20, 100, and far beyond
- One door and two categories at the start; second door, then Aqua, then Moss, then specials
- Drag-and-drop with stable grab offset, mouse and touch, overlapping-bomb picking
- Independent fuses that never pause while dragging; expired bombs cannot be rescued
- Wrong-bin chain reaction with a single game-over transition
- Collection threshold of 40 with a shipping animation
- Pause freezes fuses, movement, spawns, and level time; hidden tabs auto-pause
- Landscape and portrait layouts, mute, volume, reduced motion, fullscreen
- High score persistence with safe fallbacks when storage is missing

## Limitations

- Special bombs (short-fuse, speedy, heavy, bonus) appear only after level 18, once all four standard categories are in play.
- Audio must wait for a user gesture (browser autoplay policy). The first click or tap unlocks it.
- Visuals are 2D cartoon sprites and SVG, not skeletal animation.
- There is no campaign, account, or online leaderboard — it is a single-player local game.
