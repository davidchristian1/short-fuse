import { RULES } from '../src/config/gameConfig';
import type { CategoryId } from '../src/config/categories';
import type { Bomb } from '../src/logic/bomb';
import { GameSession, type SessionOptions } from '../src/logic/GameSession';
import type { SpecialType } from '../src/logic/difficulty';
import type { DoorId } from '../src/logic/layout';
import { seededRng } from '../src/logic/rng';

/** A running session whose automatic spawner is effectively disabled. */
export function quietSession(opts: SessionOptions = {}): GameSession {
  const s = new GameSession({ rng: seededRng(42), firstSpawnDelayMs: 1e12, ...opts });
  s.start();
  return s;
}

export function step(s: GameSession, totalMs: number, frameMs = 16): void {
  for (let t = 0; t < totalMs; t += frameMs) s.update(Math.min(frameMs, totalMs - t));
}

/** Spawns a bomb and advances time until it has walked onto the floor. */
export function activeBomb(s: GameSession, category: CategoryId, special: SpecialType | null = null, doorId: DoorId = 0): Bomb {
  const b = s.spawnNow({ doorId, category, special });
  step(s, RULES.spawnWalkMs + 20);
  if (b.state !== 'active') throw new Error(`bomb not active: ${b.state}`);
  return b;
}

export function zoneCenter(s: GameSession, id: CategoryId): { x: number; y: number } {
  const r = s.layout.zones[id];
  if (!r) throw new Error(`zone ${id} inactive`);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Grabs a bomb by its center and drops it at (x, y). */
export function dragTo(s: GameSession, b: Bomb, x: number, y: number, pointerId = 1) {
  if (!s.grab(b.id, b.x, b.y, pointerId)) return 'grab-failed' as const;
  s.moveDrag(pointerId, x, y);
  return s.release(pointerId, x, y);
}

export function sortInto(s: GameSession, b: Bomb, zone: CategoryId, pointerId = 1) {
  const c = zoneCenter(s, zone);
  return dragTo(s, b, c.x, c.y, pointerId);
}

/** Sorts `count` fresh bombs of a category into its own zone. */
export function sortMany(s: GameSession, category: CategoryId, count: number): void {
  for (let i = 0; i < count; i++) {
    const b = activeBomb(s, category);
    const r = sortInto(s, b, category);
    if (r !== 'sorted') throw new Error(`expected sorted, got ${r}`);
  }
}
