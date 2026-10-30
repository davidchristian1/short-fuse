/** Branding: change the title here and every screen (and the document title) follows. */
export const GAME_CONFIG = {
  title: 'Short Fuse',
  tagline: 'Match the bin. Beat the fuse.',
  storagePrefix: 'short-fuse',
} as const;

/** Core run rules. All gameplay timings are in milliseconds and logical pixels. */
export const RULES = {
  startingLevel: 1,
  startingScore: 0,
  collectionThreshold: 40,
  maxDoors: 2,
  maxCategories: 4,
  /** Default time on a level; individual phases may last longer or shorter. */
  levelDurationMs: 20_000,
  /** Large frame hitches are clamped so fuses never jump by more than this. */
  maxFrameDeltaMs: 50,
  /** Time a bomb spends walking out of its door before its fuse starts. */
  spawnWalkMs: 520,
  /** After a door dumps, it waits at least this long before the next dump. */
  doorCooldownMs: 480,
  /** Floor for the gap between dumps (not between bombs inside a volley). */
  minSpawnGapMs: 280,
  /** Floor for the beat between dumps, even at very high levels. */
  minDumpIntervalMs: 1_000,
  /** Extra pause after a wave, per bomb beyond the first. */
  dumpRecoverMs: 400,
  /** Hard cap: one door never spits more than this in a single dump. */
  maxVolleyPerDoor: 3,
  /** Hard safety cap on unsorted bombs regardless of difficulty output. */
  maxActiveHardCap: 18,
  /** Below this fraction of fuse remaining, a bomb shows its panic state. */
  fuseWarningFraction: 0.35,
  /** Warning ticks are emitted during the final stretch of a fuse. */
  fuseTickWindowMs: 3000,
  fuseTickIntervalMs: 500,
  /** Absolute minimum fuse for any bomb, including short-fuse specials. */
  minFuseMs: 3600,
  shortFuseMultiplier: 0.62,
  speedyMultiplier: 1.75,
  heavyMultiplier: 0.5,
  /** Heavy bombs trail the pointer slightly; this is the smoothing time constant. */
  heavyDragLagMs: 85,
  bonusBombPoints: 5,
  /** Logical radius used for bomb hit areas and spacing. */
  bombRadius: 36,
  /** Release forgiveness around a zone's edge. */
  zoneHitMargin: 8,
  returnSpeed: 560,
} as const;

/** Persisted settings defaults. */
export const DEFAULT_SETTINGS = {
  volume: 0.7,
  muted: false,
} as const;
