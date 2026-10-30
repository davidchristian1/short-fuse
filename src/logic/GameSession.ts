import { RULES } from '../config/gameConfig';
import type { CategoryId } from '../config/categories';
import { createBomb, fuseFraction, isUnsorted, transition, type Bomb } from './bomb';
import { getDifficulty, unlocksAtLevel, type DifficultyConfig, type Unlock } from './difficulty';
import { computeLayout, remapPoint, walkBounds, zoneAt, type Layout, type Orientation, type Rect } from './layout';
import { pickWanderTarget, separate, stepSpawning, stepWander } from './movement';
import { randRange, type Rng } from './rng';
import { computeSummary, createZones, type FailureCause, type RunSummary, type ZoneState } from './scoring';
import { SpawnScheduler, type SpawnRequest } from './spawner';

export type RunState = 'ready' | 'running' | 'paused' | 'over';
export type ReleaseOutcome = 'ignored' | 'returned' | 'sorted' | 'wrongZone';

export type SessionEvent =
  | { type: 'spawned'; bomb: Bomb }
  | { type: 'entered'; bomb: Bomb }
  | { type: 'grabbed'; bomb: Bomb }
  | { type: 'returned'; bomb: Bomb }
  | { type: 'sorted'; bomb: Bomb; zone: CategoryId; pending: number; bonus: number }
  | { type: 'collected'; zone: CategoryId; amount: number; secured: number }
  | { type: 'fuseWarning'; bomb: Bomb }
  | { type: 'fuseTick'; bomb: Bomb; urgency: number }
  | { type: 'levelUp'; level: number; difficulty: DifficultyConfig; unlocks: Unlock[] }
  | { type: 'layoutChanged'; layout: Layout }
  | { type: 'explode'; bomb: Bomb; cause: FailureCause; zone: CategoryId | null; chainCount: number }
  | { type: 'gameOver'; summary: RunSummary };

export interface SessionOptions {
  orientation?: Orientation;
  rng?: Rng;
  startLevel?: number;
  firstSpawnDelayMs?: number;
}

/**
 * Authoritative, renderer-independent game simulation.
 *
 * Update order (per frame): fuses -> spawning walks & wandering -> separation ->
 * spawn scheduler -> level progression. Input calls (grab/move/release) are applied
 * immediately between frames. A release is honored only while the bomb is still in
 * the 'dragging' state, so a fuse that expired in the previous update can never be
 * rescued by a late drop, and only the first terminal event can end the run.
 */
export class GameSession {
  state: RunState = 'ready';
  level: number;
  difficulty: DifficultyConfig;
  layout: Layout;
  bounds: Rect;
  readonly zones: Record<CategoryId, ZoneState> = createZones();
  /** Unsorted bombs plus the bomb that ended the run. Sorted bombs leave this list. */
  bombs: Bomb[] = [];
  securedBombs = RULES.startingScore;
  bonusPoints = 0;
  totalSorted = 0;
  elapsedMs = 0;
  levelElapsedMs = 0;
  summary: RunSummary | null = null;

  private events: SessionEvent[] = [];
  private readonly rng: Rng;
  private readonly spawner: SpawnScheduler;
  private readonly drags = new Map<number, number>();
  private nextId = 1;

  constructor(opts: SessionOptions = {}) {
    this.rng = opts.rng ?? Math.random;
    this.level = Math.max(1, Math.floor(opts.startLevel ?? RULES.startingLevel));
    this.difficulty = getDifficulty(this.level);
    this.layout = computeLayout(opts.orientation ?? 'landscape', this.difficulty.categories);
    this.bounds = walkBounds(this.layout);
    this.spawner = new SpawnScheduler(this.rng, opts.firstSpawnDelayMs ?? 550);
  }

  get activeCategories(): readonly CategoryId[] { return this.difficulty.categories; }

  get unsortedCount(): number {
    let n = 0;
    for (const b of this.bombs) if (isUnsorted(b)) n++;
    return n;
  }

  get pendingTotal(): number {
    let n = 0;
    for (const id of this.difficulty.categories) n += this.zones[id].pending;
    return n;
  }

  /** Points already banked this run (does not include pending bombs). */
  get bankedScore(): number { return this.securedBombs + this.bonusPoints; }

  drainEvents(): SessionEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  start(): void {
    if (this.state === 'ready') this.state = 'running';
  }

  pause(): boolean {
    if (this.state !== 'running') return false;
    for (const pointerId of [...this.drags.keys()]) this.cancelDrag(pointerId);
    this.state = 'paused';
    return true;
  }

  resume(): boolean {
    if (this.state !== 'paused') return false;
    this.state = 'running';
    return true;
  }

  getBomb(id: number): Bomb | undefined {
    return this.bombs.find((b) => b.id === id);
  }

  draggedBombFor(pointerId: number): Bomb | undefined {
    const id = this.drags.get(pointerId);
    return id === undefined ? undefined : this.getBomb(id);
  }

  /**
   * Top-most active bomb under a point. Later-spawned bombs are preferred on
   * overlap so the pick matches the draw order used by the renderer.
   */
  pickBombAt(x: number, y: number, radius?: number): Bomb | undefined {
    const r = radius ?? this.layout.pickRadius;
    let picked: Bomb | undefined;
    for (const bomb of this.bombs) {
      if (bomb.state !== 'active') continue;
      if (Math.hypot(bomb.x - x, bomb.y - y) <= r) picked = bomb;
    }
    return picked;
  }

  setOrientation(orientation: Orientation): void {
    if (this.layout.orientation === orientation) return;
    for (const pointerId of [...this.drags.keys()]) this.cancelDrag(pointerId);
    const prevFloor = this.layout.floor;
    this.layout = computeLayout(orientation, this.difficulty.categories);
    this.bounds = walkBounds(this.layout);
    const nextFloor = this.layout.floor;
    for (const bomb of this.bombs) {
      const p = remapPoint(bomb.x, bomb.y, prevFloor, nextFloor);
      bomb.x = p.x;
      bomb.y = p.y;
      const t = remapPoint(bomb.wander.targetX, bomb.wander.targetY, prevFloor, nextFloor);
      bomb.wander.targetX = t.x;
      bomb.wander.targetY = t.y;
      const from = remapPoint(bomb.spawn.fromX, bomb.spawn.fromY, prevFloor, nextFloor);
      const to = remapPoint(bomb.spawn.toX, bomb.spawn.toY, prevFloor, nextFloor);
      bomb.spawn.fromX = from.x;
      bomb.spawn.fromY = from.y;
      bomb.spawn.toX = to.x;
      bomb.spawn.toY = to.y;
    }
    this.emit({ type: 'layoutChanged', layout: this.layout });
  }

  // ---------------------------------------------------------------- input

  grab(bombId: number, px: number, py: number, pointerId: number): boolean {
    if (this.state !== 'running' || this.drags.has(pointerId)) return false;
    const bomb = this.getBomb(bombId);
    if (!bomb || bomb.state !== 'active' || bomb.fuseRemainingMs <= 0) return false;
    if (!transition(bomb, 'dragging')) return false;
    bomb.drag = { pointerId, offsetX: bomb.x - px, offsetY: bomb.y - py, targetX: bomb.x, targetY: bomb.y };
    bomb.vx = 0;
    bomb.vy = 0;
    this.drags.set(pointerId, bomb.id);
    this.emit({ type: 'grabbed', bomb });
    return true;
  }

  moveDrag(pointerId: number, px: number, py: number): void {
    if (this.state !== 'running') return;
    const bomb = this.draggedBombFor(pointerId);
    if (!bomb || bomb.state !== 'dragging' || !bomb.drag) return;
    const r = RULES.bombRadius * 0.5;
    bomb.drag.targetX = Math.max(r, Math.min(this.layout.width - r, px + bomb.drag.offsetX));
    bomb.drag.targetY = Math.max(this.layout.hud.y + this.layout.hud.h * 0.5, Math.min(this.layout.height - r, py + bomb.drag.offsetY));
    if (bomb.special !== 'heavy') {
      bomb.x = bomb.drag.targetX;
      bomb.y = bomb.drag.targetY;
    }
  }

  /** Drops the bomb held by this pointer. The destination is judged only here, at release. */
  release(pointerId: number, px?: number, py?: number): ReleaseOutcome {
    const bombId = this.drags.get(pointerId);
    if (bombId === undefined) return 'ignored';
    if (px !== undefined && py !== undefined) this.moveDrag(pointerId, px, py);
    this.drags.delete(pointerId);
    const bomb = this.getBomb(bombId);
    if (this.state !== 'running' || !bomb || bomb.state !== 'dragging' || !bomb.drag) return 'ignored';
    if (bomb.fuseRemainingMs <= 0) return 'ignored';

    const dropX = bomb.drag.targetX, dropY = bomb.drag.targetY;
    bomb.x = dropX;
    bomb.y = dropY;
    bomb.drag = null;
    const zone = zoneAt(this.layout, dropX, dropY);

    if (zone === null) {
      transition(bomb, 'active');
      bomb.wander.pauseMs = 250;
      pickWanderTarget(bomb, this.bounds, this.rng);
      this.emit({ type: 'returned', bomb });
      return 'returned';
    }
    if (zone === bomb.category) {
      this.sortBomb(bomb, zone);
      return 'sorted';
    }
    this.explode(bomb, 'wrongZone', zone);
    return 'wrongZone';
  }

  /** Pointer lost (cancel/pause): bomb goes back to the floor without being judged. */
  cancelDrag(pointerId: number): void {
    const bombId = this.drags.get(pointerId);
    this.drags.delete(pointerId);
    if (bombId === undefined) return;
    const bomb = this.getBomb(bombId);
    if (!bomb || bomb.state !== 'dragging') return;
    bomb.drag = null;
    transition(bomb, 'active');
    bomb.wander.pauseMs = 250;
    pickWanderTarget(bomb, this.bounds, this.rng);
    this.emit({ type: 'returned', bomb });
  }

  // ---------------------------------------------------------------- simulation

  update(rawDtMs: number): void {
    if (this.state !== 'running') return;
    const dt = Math.max(0, Math.min(RULES.maxFrameDeltaMs, rawDtMs));
    if (dt === 0) return;
    this.elapsedMs += dt;

    // 1. Fuses. The first expiry ends the run immediately.
    for (const bomb of this.bombs) {
      if (!bomb.fuseRunning || (bomb.state !== 'active' && bomb.state !== 'dragging')) continue;
      bomb.fuseRemainingMs -= dt;
      if (bomb.fuseRemainingMs <= 0) {
        bomb.fuseRemainingMs = 0;
        this.explode(bomb, 'fuseExpired', null);
        return;
      }
      if (!bomb.fx.warned && fuseFraction(bomb) <= RULES.fuseWarningFraction) {
        bomb.fx.warned = true;
        this.emit({ type: 'fuseWarning', bomb });
      }
      if (bomb.fuseRemainingMs <= RULES.fuseTickWindowMs) {
        bomb.fx.nextTickAtMs -= dt;
        if (bomb.fx.nextTickAtMs <= 0) {
          bomb.fx.nextTickAtMs = RULES.fuseTickIntervalMs * (0.5 + 0.5 * bomb.fuseRemainingMs / RULES.fuseTickWindowMs);
          this.emit({ type: 'fuseTick', bomb, urgency: 1 - bomb.fuseRemainingMs / RULES.fuseTickWindowMs });
        }
      }
    }

    // 2. Movement.
    for (const bomb of this.bombs) {
      if (bomb.state === 'spawning') {
        if (stepSpawning(bomb, dt)) {
          transition(bomb, 'active');
          bomb.fuseRunning = true;
          pickWanderTarget(bomb, this.bounds, this.rng);
          this.emit({ type: 'entered', bomb });
        }
      } else if (bomb.state === 'active') {
        stepWander(bomb, dt, this.bounds, this.difficulty, this.rng);
      } else if (bomb.state === 'dragging' && bomb.drag && bomb.special === 'heavy') {
        const k = Math.min(1, dt / RULES.heavyDragLagMs);
        bomb.x += (bomb.drag.targetX - bomb.x) * k;
        bomb.y += (bomb.drag.targetY - bomb.y) * k;
      }
    }
    separate(this.bombs, dt, this.bounds);

    // 3. Spawning.
    for (const req of this.spawner.update(dt, this.difficulty, this.unsortedCount)) this.spawnBomb(req);

    // 4. Level progression (time-based, unbounded).
    this.levelElapsedMs += dt;
    while (this.levelElapsedMs >= this.difficulty.levelDurationMs) {
      this.levelElapsedMs -= this.difficulty.levelDurationMs;
      this.setLevel(this.level + 1);
    }
  }

  setLevel(level: number): void {
    const prevCats = this.difficulty.categories.length;
    this.level = Math.max(1, Math.floor(level));
    this.difficulty = getDifficulty(this.level);
    if (this.difficulty.categories.length !== prevCats) {
      this.layout = computeLayout(this.layout.orientation, this.difficulty.categories);
      this.bounds = walkBounds(this.layout);
      this.emit({ type: 'layoutChanged', layout: this.layout });
    }
    this.emit({ type: 'levelUp', level: this.level, difficulty: this.difficulty, unlocks: unlocksAtLevel(this.level) });
  }

  /** Spawns a specific bomb immediately (used by tests and the ?debug QA hooks). */
  spawnNow(req: SpawnRequest): Bomb {
    this.spawnBomb(req);
    return this.bombs[this.bombs.length - 1];
  }

  private spawnBomb(req: SpawnRequest): void {
    const door = this.layout.doors[req.doorId];
    const d = this.difficulty;
    let fuse = d.fuseMs * (1 + (this.rng() * 2 - 1) * d.fuseVariance);
    if (req.special === 'shortFuse') fuse *= RULES.shortFuseMultiplier;
    fuse = Math.max(RULES.minFuseMs, Math.round(fuse));
    const speedMul = req.special === 'speedy' ? RULES.speedyMultiplier : req.special === 'heavy' ? RULES.heavyMultiplier : 1;
    const b = this.bounds;
    const volleySize = Math.max(1, req.volleySize ?? 1);
    const volleyIndex = req.volleyIndex ?? 0;
    const fan = volleySize <= 1
      ? randRange(this.rng, -70, 70)
      : (volleyIndex - (volleySize - 1) / 2) * 78 + randRange(this.rng, -14, 14);
    const fromX = door.exitX + (volleySize <= 1 ? 0 : (volleyIndex - (volleySize - 1) / 2) * 18);
    const toX = Math.max(b.x, Math.min(b.x + b.w, door.exitX + fan));
    const toY = Math.max(b.y, Math.min(b.y + b.h, b.y + randRange(this.rng, 18, 120)));
    const bomb = createBomb({
      id: this.nextId++, category: req.category, special: req.special, doorId: req.doorId,
      fuseMs: fuse, speedMul, fromX, fromY: door.exitY, toX, toY, spawnMs: RULES.spawnWalkMs,
    });
    this.bombs.push(bomb);
    this.emit({ type: 'spawned', bomb });
  }

  private sortBomb(bomb: Bomb, zone: CategoryId): void {
    transition(bomb, 'sorted');
    bomb.fuseRunning = false;
    bomb.destinationZone = zone;
    this.bombs = this.bombs.filter((b) => b !== bomb);
    const z = this.zones[zone];
    z.pending++;
    z.totalSorted++;
    this.totalSorted++;
    const bonus = bomb.special === 'bonus' ? RULES.bonusBombPoints : 0;
    this.bonusPoints += bonus;
    this.emit({ type: 'sorted', bomb, zone, pending: z.pending, bonus });
    if (z.pending >= RULES.collectionThreshold) {
      z.pending -= RULES.collectionThreshold;
      z.collections++;
      this.securedBombs += RULES.collectionThreshold;
      this.emit({ type: 'collected', zone, amount: RULES.collectionThreshold, secured: this.securedBombs });
    }
  }

  private explode(bomb: Bomb, cause: FailureCause, zone: CategoryId | null): void {
    if (this.state === 'over') return;
    if (!transition(bomb, 'exploding')) return;
    bomb.fuseRunning = false;
    bomb.destinationZone = zone;
    bomb.drag = null;
    this.drags.clear();
    this.state = 'over';

    const summary = computeSummary({
      cause, bombCategory: bomb.category, detonatedZone: zone, zones: this.zones,
      securedBombs: this.securedBombs, bonusPoints: this.bonusPoints, levelReached: this.level,
      totalSorted: this.totalSorted, durationMs: this.elapsedMs,
    });
    if (zone) this.zones[zone].pending = 0;
    this.summary = summary;
    this.emit({ type: 'explode', bomb, cause, zone, chainCount: summary.lostBombs });
    this.emit({ type: 'gameOver', summary });
  }

  private emit(e: SessionEvent): void {
    this.events.push(e);
  }
}
