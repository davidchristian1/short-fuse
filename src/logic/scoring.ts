import { CATEGORY_ORDER, type CategoryId } from '../config/categories';

export type FailureCause = 'wrongZone' | 'fuseExpired';

export interface ZoneState {
  readonly category: CategoryId;
  /** Safely sorted bombs waiting for the next collection. */
  pending: number;
  /** Number of full batches this zone has shipped. */
  collections: number;
  totalSorted: number;
}

export interface RunSummary {
  cause: FailureCause;
  /** Category of the bomb that exploded. */
  bombCategory: CategoryId;
  /** Zone the wrong bomb was dropped into (wrongZone only). */
  detonatedZone: CategoryId | null;
  securedBombs: number;
  bonusPoints: number;
  survivorBombs: number;
  lostBombs: number;
  finalScore: number;
  levelReached: number;
  totalSorted: number;
  totalExplosions: number;
  collections: number;
  durationMs: number;
}

export function createZones(): Record<CategoryId, ZoneState> {
  const zones = {} as Record<CategoryId, ZoneState>;
  for (const id of CATEGORY_ORDER) zones[id] = { category: id, pending: 0, collections: 0, totalSorted: 0 };
  return zones;
}

/**
 * Final scoring rules:
 * - secured bombs (collected batches) always count;
 * - bonus points always count;
 * - pending bombs in zones other than the detonated one count as survivors;
 * - pending bombs in the detonated zone are lost;
 * - unsorted bombs never count.
 */
export function computeSummary(input: {
  cause: FailureCause;
  bombCategory: CategoryId;
  detonatedZone: CategoryId | null;
  zones: Readonly<Record<CategoryId, ZoneState>>;
  securedBombs: number;
  bonusPoints: number;
  levelReached: number;
  totalSorted: number;
  durationMs: number;
}): RunSummary {
  let survivors = 0;
  let lost = 0;
  let collections = 0;
  for (const id of CATEGORY_ORDER) {
    const z = input.zones[id];
    collections += z.collections;
    if (id === input.detonatedZone) lost += z.pending;
    else survivors += z.pending;
  }
  return {
    cause: input.cause,
    bombCategory: input.bombCategory,
    detonatedZone: input.detonatedZone,
    securedBombs: input.securedBombs,
    bonusPoints: input.bonusPoints,
    survivorBombs: survivors,
    lostBombs: lost,
    finalScore: input.securedBombs + input.bonusPoints + survivors,
    levelReached: input.levelReached,
    totalSorted: input.totalSorted,
    totalExplosions: 1 + lost,
    collections,
    durationMs: input.durationMs,
  };
}
