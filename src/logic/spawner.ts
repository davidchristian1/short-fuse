import { RULES } from '../config/gameConfig';
import type { CategoryId } from '../config/categories';
import { DIFFICULTY_TUNING, type DifficultyConfig, type SpecialType } from './difficulty';
import type { DoorId } from './layout';
import { pick, pickWeighted, type Rng } from './rng';

export interface SpawnRequest {
  doorId: DoorId;
  category: CategoryId;
  special: SpecialType | null;
  /** 0-based index inside this door's dump. */
  volleyIndex?: number;
  /** How many bombs this door is dumping on this beat. */
  volleySize?: number;
}

/**
 * Decides when, where, and what to spawn. Pure apart from the injected RNG.
 *
 * A "dump" is one beat: one door (or both) opening and spitting 1–4 bombs at
 * once, Sort or 'Splode style. Bombs inside a dump share a frame. The gap
 * between beats is the door-open pace — bigger waves wait longer.
 */
export class SpawnScheduler {
  private untilNextMs: number;
  private lastDoor: DoorId = 1;
  private burstLeft = 0;
  private untilBurstRecovery = false;
  private runCategory: CategoryId | null = null;
  private runLeft = 0;
  private recent: CategoryId[] = [];

  constructor(private readonly rng: Rng, firstDelayMs = 800) {
    this.untilNextMs = firstDelayMs;
  }

  update(dtMs: number, diff: DifficultyConfig, activeCount: number): SpawnRequest[] {
    const out: SpawnRequest[] = [];
    const limit = Math.min(diff.maxActiveBombs, RULES.maxActiveHardCap);
    this.untilNextMs -= dtMs;

    if (this.untilNextMs > 0) return out;
    if (activeCount >= limit) {
      this.untilNextMs = 0;
      return out;
    }

    const slots = limit - activeCount;
    const [n0, n1] = this.planBeat(diff, slots);
    if (n0 > 0) this.emitVolley(0, n0, diff, out);
    if (n1 > 0) this.emitVolley(1, n1, diff, out);

    this.untilNextMs = this.nextInterval(diff, out.length);
    return out;
  }

  private planBeat(diff: DifficultyConfig, slots: number): [number, number] {
    const sizes: [number, number] = [0, 0];
    if (slots <= 0) return sizes;

    const primary = this.rollCount(diff.dumpPrimary, diff.easeChance);
    if (diff.activeDoors === 1) {
      sizes[0] = Math.min(primary, slots, diff.maxVolley, RULES.maxVolleyPerDoor);
      return sizes;
    }

    const pair = diff.dumpPartner > 0 && this.rng() < diff.simultaneousChance;
    const first = this.chooseDoor(diff);
    const second: DoorId = first === 0 ? 1 : 0;
    sizes[first] = Math.min(Math.max(1, primary), slots, diff.maxVolley, RULES.maxVolleyPerDoor);
    if (pair) {
      const remaining = slots - sizes[first];
      if (remaining > 0) {
        sizes[second] = Math.min(Math.max(1, diff.dumpPartner), remaining, diff.maxVolley, RULES.maxVolleyPerDoor);
      }
    }
    return sizes;
  }

  private rollCount(n: number, ease: number): number {
    if (n <= 1) return 1;
    if (this.rng() < ease) return n - 1;
    return n;
  }

  private emitVolley(doorId: DoorId, size: number, diff: DifficultyConfig, out: SpawnRequest[]): void {
    const n = Math.max(1, Math.min(size, diff.maxVolley, RULES.maxVolleyPerDoor));
    for (let i = 0; i < n; i++) out.push(this.makeRequest(doorId, diff, i, n));
    this.lastDoor = doorId;
  }

  private makeRequest(doorId: DoorId, diff: DifficultyConfig, volleyIndex: number, volleySize: number): SpawnRequest {
    const category = this.chooseCategory(diff);
    this.recent.push(category);
    if (this.recent.length > 4) this.recent.shift();
    return { doorId, category, special: this.chooseSpecial(diff), volleyIndex, volleySize };
  }

  private chooseDoor(diff: DifficultyConfig): DoorId {
    if (diff.activeDoors === 1) return 0;
    if (diff.pattern === 'alternate') return this.lastDoor === 0 ? 1 : 0;
    return this.rng() < diff.secondDoorShare ? 1 : 0;
  }

  private chooseCategory(diff: DifficultyConfig): CategoryId {
    const cats = diff.categories;
    if (diff.pattern === 'runs') {
      if (this.runLeft > 0 && this.runCategory && cats.includes(this.runCategory)) {
        this.runLeft--;
        return this.runCategory;
      }
      this.runCategory = pick(this.rng, cats);
      this.runLeft = 1 + Math.floor(this.rng() * 2);
      return this.runCategory;
    }
    const last3 = this.recent.slice(-3);
    const streak = last3.length === 3 && last3.every((c) => c === last3[0]) ? last3[0] : null;
    const weights = cats.map((c) => (c === streak ? 0 : c === diff.newCategory ? 1.6 : 1));
    return pickWeighted(this.rng, cats, weights);
  }

  private chooseSpecial(diff: DifficultyConfig): SpecialType | null {
    if (!diff.specialTypes.length || this.rng() >= diff.specialChance) return null;
    const types = diff.specialTypes;
    const weights = types.map((_, i) => (i === types.length - 1 ? 2 : 1));
    return pickWeighted(this.rng, types, weights);
  }

  private nextInterval(diff: DifficultyConfig, dumped: number): number {
    let base = diff.spawnIntervalMs * (1 + (this.rng() * 2 - 1) * diff.spawnJitter);
    // Burst compression is endless-only so early doors never slap open.
    if (diff.level >= DIFFICULTY_TUNING.endlessLevel && (diff.pattern === 'burst' || diff.pattern === 'mixed')) {
      if (this.burstLeft > 0) {
        this.burstLeft--;
        base = diff.spawnIntervalMs * 0.78;
        if (this.burstLeft === 0) this.untilBurstRecovery = true;
      } else if (this.untilBurstRecovery) {
        this.untilBurstRecovery = false;
        base = diff.spawnIntervalMs * 1.45;
      } else if (this.rng() < (diff.pattern === 'burst' ? 0.4 : 0.18)) {
        this.burstLeft = 2;
      }
    }
    const recover = RULES.dumpRecoverMs * Math.max(0, dumped - 1);
    return Math.max(RULES.minDumpIntervalMs, base + recover);
  }
}
