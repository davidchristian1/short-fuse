import { RULES } from '../config/gameConfig';
import { CATEGORY_ORDER, type CategoryId } from '../config/categories';

export type SpecialType = 'shortFuse' | 'speedy' | 'heavy' | 'bonus';
export type SpawnPattern = 'steady' | 'alternate' | 'burst' | 'runs' | 'mixed';
export type Stage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type VolleySize = 0 | 1 | 2 | 3 | 4;

export interface DifficultyConfig {
  level: number;
  stage: Stage;
  stageName: string;
  activeDoors: 1 | 2;
  categories: CategoryId[];
  spawnIntervalMs: number;
  /** Fractional +/- randomness applied to each spawn gap. */
  spawnJitter: number;
  maxActiveBombs: number;
  fuseMs: number;
  /** Fractional +/- randomness applied to each bomb's fuse. */
  fuseVariance: number;
  moveSpeed: number;
  /** 0..1: lateral wobble and mid-path direction changes. */
  trajectoryComplexity: number;
  wanderPauseMs: readonly [number, number];
  /** Share of spawns that come from the second door when both are open. */
  secondDoorShare: number;
  /** Chance both doors dump on the same beat. */
  simultaneousChance: number;
  /** Largest number of bombs one door may spit in a single dump. */
  maxVolley: 1 | 2 | 3 | 4;
  /** Typical dump size for the primary door this phase. */
  dumpPrimary: 1 | 2 | 3 | 4;
  /** Typical dump size for the other door when both fire. 0 = never pair. */
  dumpPartner: VolleySize;
  /** Chance a dump uses one fewer bomb on the primary door (2-1 can roll 1-1). */
  easeChance: number;
  /** Chance a dump is a multi-bomb volley once maxVolley > 1. */
  volleyChance: number;
  /** How long this numbered level lasts before the next one. */
  levelDurationMs: number;
  specialChance: number;
  specialTypes: SpecialType[];
  pattern: SpawnPattern;
  /** True for the first levels after a category unlock (spawn relief is active). */
  relief: boolean;
  /** Category that unlocked most recently and is still being introduced, if any. */
  newCategory: CategoryId | null;
}

export interface Unlock {
  kind: 'door' | 'category' | 'special' | 'volley';
  id: string;
  title: string;
  detail: string;
}

export interface PhaseDef {
  from: number;
  stage: Stage;
  name: string;
  doors: 1 | 2;
  categoryCount: 2 | 3 | 4;
  primary: 1 | 2 | 3 | 4;
  partner: VolleySize;
  pairChance: number;
  easeChance: number;
  spawnIntervalMs: number;
  maxActive: number;
  fuseMs: number;
  moveSpeed: number;
  durationMs: number;
}

type Curve = {
  points: readonly (readonly [number, number])[];
  /** Beyond the last point, approach `limit` exponentially with this level scale. */
  limit: number;
  scale: number;
};

/**
 * Sort or 'Splode (SM64DS) teaches one axis at a time, then ramps dump size
 * slowly. Beats stay human-sortable through level 20: about 2.4s for 1-1,
 * then extra recover time as waves grow. Hard cap is 3-3, never 4.
 * Levels are unbounded; every curve is bounded.
 */
export const PHASES: readonly PhaseDef[] = [
  { from: 1,  stage: 'A', name: 'Learn the Basics',   doors: 1, categoryCount: 2, primary: 1, partner: 0, pairChance: 0,    easeChance: 0,    spawnIntervalMs: 1600, maxActive: 4,  fuseMs: 8400, moveSpeed: 42, durationMs: 18_000 },
  { from: 2,  stage: 'B', name: 'Double Doors',       doors: 2, categoryCount: 2, primary: 1, partner: 1, pairChance: 0.38, easeChance: 0,    spawnIntervalMs: 1750, maxActive: 5,  fuseMs: 8200, moveSpeed: 46, durationMs: 28_000 },
  { from: 3,  stage: 'B', name: 'Dual Stream',        doors: 2, categoryCount: 2, primary: 1, partner: 1, pairChance: 0.55, easeChance: 0,    spawnIntervalMs: 1700, maxActive: 6,  fuseMs: 8000, moveSpeed: 50, durationMs: 22_000 },
  { from: 4,  stage: 'C', name: 'Third Category',     doors: 2, categoryCount: 3, primary: 1, partner: 1, pairChance: 0.65, easeChance: 0,    spawnIntervalMs: 1650, maxActive: 7,  fuseMs: 7900, moveSpeed: 52, durationMs: 22_000 },
  { from: 5,  stage: 'D', name: 'Full Factory',       doors: 2, categoryCount: 4, primary: 1, partner: 1, pairChance: 0.78, easeChance: 0,    spawnIntervalMs: 2050, maxActive: 8,  fuseMs: 7800, moveSpeed: 54, durationMs: 22_000 },
  { from: 6,  stage: 'E', name: 'Uneven Dumps',       doors: 2, categoryCount: 4, primary: 2, partner: 1, pairChance: 0.82, easeChance: 0.3,  spawnIntervalMs: 2250, maxActive: 8,  fuseMs: 7600, moveSpeed: 56, durationMs: 22_000 },
  { from: 9,  stage: 'E', name: 'Double Dumps',       doors: 2, categoryCount: 4, primary: 2, partner: 2, pairChance: 0.84, easeChance: 0.2,  spawnIntervalMs: 2150, maxActive: 9,  fuseMs: 7400, moveSpeed: 58, durationMs: 22_000 },
  { from: 13, stage: 'F', name: 'Triple Mix',         doors: 2, categoryCount: 4, primary: 3, partner: 2, pairChance: 0.86, easeChance: 0.16, spawnIntervalMs: 2050, maxActive: 10, fuseMs: 7200, moveSpeed: 62, durationMs: 22_000 },
  { from: 17, stage: 'F', name: 'Triple Dumps',       doors: 2, categoryCount: 4, primary: 3, partner: 3, pairChance: 0.88, easeChance: 0.12, spawnIntervalMs: 1950, maxActive: 11, fuseMs: 7000, moveSpeed: 66, durationMs: 22_000 },
  { from: 21, stage: 'G', name: 'Endless Escalation', doors: 2, categoryCount: 4, primary: 3, partner: 3, pairChance: 0.9,  easeChance: 0.1,  spawnIntervalMs: 1850, maxActive: 12, fuseMs: 6600, moveSpeed: 70, durationMs: 20_000 },
];

export const DIFFICULTY_TUNING = {
  secondDoorLevel: 2,
  thirdCategoryLevel: 4,
  fourthCategoryLevel: 5,
  endlessLevel: 21,
  volley2Level: 6,
  volley22Level: 9,
  volley3Level: 13,
  volley33Level: 17,
  specialUnlocks: [
    { type: 'shortFuse', level: 21 },
    { type: 'speedy', level: 23 },
    { type: 'heavy', level: 25 },
    { type: 'bonus', level: 27 },
  ] as const satisfies readonly { type: SpecialType; level: number }[],
  relief: { levels: 1, spawnMultiplier: 1.06, fuseBonusMs: 250 },
  /** Endless tail only. Stays human-sortable: 3-3 waves never collapse to 1s beats. */
  spawnIntervalMs: { points: [[21, 1850], [30, 1650], [45, 1500], [70, 1400]], limit: 1280, scale: 40 } as Curve,
  maxActive: { points: [[21, 12], [35, 13], [55, 14]], limit: 16, scale: 40 } as Curve,
  fuseMs: { points: [[21, 6600], [35, 6000], [55, 5400]], limit: 4600, scale: 40 } as Curve,
  fuseVariance: { points: [[1, 0], [6, 0.03], [13, 0.06], [21, 0.09]], limit: 0.13, scale: 40 } as Curve,
  moveSpeed: { points: [[21, 70], [35, 78], [55, 86]], limit: 94, scale: 40 } as Curve,
  spawnJitter: { points: [[1, 0.04], [5, 0.06], [13, 0.1], [21, 0.14]], limit: 0.22, scale: 40 } as Curve,
  trajectory: { points: [[1, 0.05], [5, 0.18], [13, 0.32], [21, 0.48]], limit: 0.8, scale: 40 } as Curve,
  pauseMin: { points: [[1, 420], [9, 280], [17, 180], [21, 140]], limit: 80, scale: 40 } as Curve,
  pauseMax: { points: [[1, 900], [9, 620], [17, 420], [21, 320]], limit: 200, scale: 40 } as Curve,
  secondDoorShare: { points: [[2, 0.45], [5, 0.5]], limit: 0.5, scale: 1 } as Curve,
  specialChance: { points: [[21, 0.07], [27, 0.14]], limit: 0.26, scale: 40 } as Curve,
  endlessPatterns: ['mixed', 'burst', 'alternate', 'runs', 'steady', 'burst', 'mixed', 'runs'] as SpawnPattern[],
};

/** Piecewise-linear interpolation with a bounded exponential tail. */
export function evalCurve(curve: Curve, level: number): number {
  const pts = curve.points;
  if (level <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [l1, v1] = pts[i];
    if (level <= l1) {
      const [l0, v0] = pts[i - 1];
      return v0 + ((v1 - v0) * (level - l0)) / (l1 - l0);
    }
  }
  const [lastL, lastV] = pts[pts.length - 1];
  return curve.limit + (lastV - curve.limit) * Math.exp(-(level - lastL) / curve.scale);
}

function normalizeLevel(level: number): number {
  if (!Number.isFinite(level) || level < 1) return 1;
  return Math.floor(level);
}

export function phaseAt(rawLevel: number): PhaseDef {
  const level = normalizeLevel(rawLevel);
  let found = PHASES[0];
  for (const p of PHASES) if (level >= p.from) found = p;
  return found;
}

export function categoriesForLevel(level: number): CategoryId[] {
  const count = phaseAt(level).categoryCount;
  return CATEGORY_ORDER.slice(0, Math.min(count, RULES.maxCategories));
}

function patternFor(level: number, doors: 1 | 2): SpawnPattern {
  const t = DIFFICULTY_TUNING;
  if (doors === 1) return 'steady';
  if (level < t.endlessLevel) return 'alternate';
  const idx = (level * 7 + Math.floor(level / 8)) % t.endlessPatterns.length;
  return t.endlessPatterns[idx];
}

export function getDifficulty(rawLevel: number): DifficultyConfig {
  const level = normalizeLevel(rawLevel);
  const t = DIFFICULTY_TUNING;
  const phase = phaseAt(level);
  const categories = categoriesForLevel(level);
  const activeDoors = phase.doors;

  let newCategory: CategoryId | null = null;
  for (const [unlockLevel, idx] of [[t.thirdCategoryLevel, 2], [t.fourthCategoryLevel, 3]] as const) {
    if (level >= unlockLevel && level < unlockLevel + t.relief.levels) newCategory = CATEGORY_ORDER[idx];
  }
  const relief = newCategory !== null;

  let spawnIntervalMs = level >= t.endlessLevel ? evalCurve(t.spawnIntervalMs, level) : phase.spawnIntervalMs;
  spawnIntervalMs *= relief ? t.relief.spawnMultiplier : 1;
  spawnIntervalMs = Math.max(RULES.minDumpIntervalMs, Math.round(spawnIntervalMs));

  let fuseMs = level >= t.endlessLevel ? evalCurve(t.fuseMs, level) : phase.fuseMs;
  fuseMs += relief ? t.relief.fuseBonusMs : 0;
  fuseMs = Math.max(RULES.minFuseMs, Math.round(fuseMs));

  let maxActiveBombs = level >= t.endlessLevel ? evalCurve(t.maxActive, level) : phase.maxActive;
  maxActiveBombs = Math.max(1, Math.min(RULES.maxActiveHardCap, Math.round(maxActiveBombs)));

  const maxVolley = maxVolleyForLevel(level);
  const dumpPrimary = Math.min(phase.primary, maxVolley) as 1 | 2 | 3 | 4;
  const dumpPartner = Math.min(phase.partner, maxVolley) as 0 | 1 | 2 | 3 | 4;
  const moveSpeed = level >= t.endlessLevel ? evalCurve(t.moveSpeed, level) : phase.moveSpeed;

  const specialTypes = t.specialUnlocks.filter((s) => level >= s.level).map((s) => s.type);
  const pauseMin = evalCurve(t.pauseMin, level);
  const pauseMax = Math.max(pauseMin + 50, evalCurve(t.pauseMax, level));
  const pairChance = Math.max(0, Math.min(0.92, phase.pairChance));

  return {
    level,
    stage: phase.stage,
    stageName: phase.name,
    activeDoors,
    categories,
    spawnIntervalMs,
    spawnJitter: evalCurve(t.spawnJitter, level),
    maxActiveBombs,
    fuseMs,
    fuseVariance: evalCurve(t.fuseVariance, level),
    moveSpeed,
    trajectoryComplexity: Math.min(1, evalCurve(t.trajectory, level)),
    wanderPauseMs: [pauseMin, pauseMax],
    secondDoorShare: activeDoors === 2 ? evalCurve(t.secondDoorShare, level) : 0,
    simultaneousChance: activeDoors === 2 ? pairChance : 0,
    maxVolley,
    dumpPrimary,
    dumpPartner,
    easeChance: phase.easeChance,
    volleyChance: maxVolley > 1 ? 1 - phase.easeChance : 0,
    levelDurationMs: phase.durationMs,
    specialChance: specialTypes.length ? evalCurve(t.specialChance, level) : 0,
    specialTypes,
    pattern: patternFor(level, activeDoors),
    relief,
    newCategory,
  };
}

export function maxVolleyForLevel(rawLevel: number): 1 | 2 | 3 | 4 {
  const phase = phaseAt(rawLevel);
  const n = Math.min(RULES.maxVolleyPerDoor, Math.max(1, phase.primary, phase.partner));
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  return 1;
}

export const SPECIAL_INFO: Record<SpecialType, { title: string; detail: string }> = {
  shortFuse: { title: 'SHORT-FUSE BOMBS', detail: 'Red alarm badge: shorter fuse. Sort it first!' },
  speedy: { title: 'SPEEDY BOMBS', detail: 'Lightning badge: zips around the floor.' },
  heavy: { title: 'HEAVY BOMBS', detail: 'Weight badge: slow and a bit sluggish to drag.' },
  bonus: { title: 'BONUS BOMBS', detail: `Star badge: +${RULES.bonusBombPoints} points when sorted correctly.` },
};

/** Mechanics that become available exactly at this level (for announcements). */
export function unlocksAtLevel(rawLevel: number): Unlock[] {
  const level = normalizeLevel(rawLevel);
  const t = DIFFICULTY_TUNING;
  const out: Unlock[] = [];
  if (level === t.secondDoorLevel) {
    out.push({ kind: 'door', id: 'door2', title: 'SECOND DOOR OPEN!', detail: 'Bombs now arrive from both doors — more and more often at the same time.' });
  }
  if (level === t.thirdCategoryLevel) {
    out.push({ kind: 'category', id: 'aqua', title: 'NEW BOMB: AQUA', detail: 'Water-drop teardrop bombs go to the AQUA zone.' });
  }
  if (level === t.fourthCategoryLevel) {
    out.push({ kind: 'category', id: 'moss', title: 'NEW BOMB: MOSS', detail: 'Leaf-sprout boxy bombs go to the MOSS zone.' });
  }
  if (level === t.volley2Level) {
    out.push({ kind: 'volley', id: 'volley2', title: 'UNEVEN DUMPS!', detail: 'Doors can spit two and one. You get a longer pause to sort the wave.' });
  }
  if (level === t.volley22Level) {
    out.push({ kind: 'volley', id: 'volley22', title: 'DOUBLE DUMPS!', detail: 'Both doors can dump two bombs at once.' });
  }
  if (level === t.volley3Level) {
    out.push({ kind: 'volley', id: 'volley3', title: 'TRIPLE MIX!', detail: 'Doors can dump three and two in one pop.' });
  }
  if (level === t.volley33Level) {
    out.push({ kind: 'volley', id: 'volley33', title: 'TRIPLE DUMPS!', detail: 'Both doors can dump three bombs. That’s the biggest wave.' });
  }
  for (const s of t.specialUnlocks) {
    if (level === s.level) out.push({ kind: 'special', id: s.type, ...SPECIAL_INFO[s.type] });
  }
  return out;
}
