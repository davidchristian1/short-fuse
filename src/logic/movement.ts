import { RULES } from '../config/gameConfig';
import type { Bomb } from './bomb';
import type { DifficultyConfig } from './difficulty';
import type { Rect } from './layout';
import { randRange, type Rng } from './rng';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function clampToRect(b: { x: number; y: number }, r: Rect): void {
  b.x = clamp(b.x, r.x, r.x + r.w);
  b.y = clamp(b.y, r.y, r.y + r.h);
}

export function pickWanderTarget(bomb: Bomb, bounds: Rect, rng: Rng): void {
  const angle = rng() * Math.PI * 2;
  const dist = randRange(rng, 90, 280);
  bomb.wander.targetX = clamp(bomb.x + Math.cos(angle) * dist, bounds.x, bounds.x + bounds.w);
  bomb.wander.targetY = clamp(bomb.y + Math.sin(angle) * dist, bounds.y, bounds.y + bounds.h);
}

/** Advances the door-exit walk. Returns true on the frame the bomb reaches the floor. */
export function stepSpawning(bomb: Bomb, dtMs: number): boolean {
  const s = bomb.spawn;
  s.elapsedMs += dtMs;
  const t = Math.min(1, s.elapsedMs / s.durationMs);
  const e = 1 - (1 - t) * (1 - t);
  bomb.x = s.fromX + (s.toX - s.fromX) * e;
  bomb.y = s.fromY + (s.toY - s.fromY) * e;
  return t >= 1;
}

/** Gentle wandering with pauses; complexity adds lateral wobble and mid-path turns. */
export function stepWander(bomb: Bomb, dtMs: number, bounds: Rect, diff: DifficultyConfig, rng: Rng): void {
  const dt = dtMs / 1000;
  const w = bomb.wander;

  // Bombs dropped outside the floor walk briskly back in.
  const outside = bomb.x < bounds.x || bomb.x > bounds.x + bounds.w || bomb.y < bounds.y || bomb.y > bounds.y + bounds.h;
  if (outside) {
    const tx = clamp(bomb.x, bounds.x, bounds.x + bounds.w);
    const ty = clamp(bomb.y, bounds.y, bounds.y + bounds.h);
    const dx = tx - bomb.x, dy = ty - bomb.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, RULES.returnSpeed * dt);
    bomb.vx = (dx / d) * RULES.returnSpeed;
    bomb.vy = (dy / d) * RULES.returnSpeed;
    bomb.x += (dx / d) * step;
    bomb.y += (dy / d) * step;
    return;
  }

  if (w.pauseMs > 0) {
    w.pauseMs -= dtMs;
    bomb.vx = 0;
    bomb.vy = 0;
    return;
  }

  const dx = w.targetX - bomb.x, dy = w.targetY - bomb.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) {
    w.pauseMs = randRange(rng, diff.wanderPauseMs[0], diff.wanderPauseMs[1]) / Math.max(0.6, bomb.speedMul);
    pickWanderTarget(bomb, bounds, rng);
    bomb.vx = 0;
    bomb.vy = 0;
    return;
  }

  w.retargetMs -= dtMs;
  if (w.retargetMs <= 0) {
    w.retargetMs = randRange(rng, 900, 1600);
    if (rng() < diff.trajectoryComplexity * 0.6) pickWanderTarget(bomb, bounds, rng);
  }

  const speed = diff.moveSpeed * bomb.speedMul;
  const ux = dx / dist, uy = dy / dist;
  w.phase += dtMs * 0.004 * bomb.speedMul;
  const lateral = Math.sin(w.phase) * speed * diff.trajectoryComplexity * 0.9;
  bomb.vx = ux * speed - uy * lateral;
  bomb.vy = uy * speed + ux * lateral;
  const step = Math.min(dist, speed * dt);
  bomb.x += ux * step - uy * lateral * dt;
  bomb.y += uy * step + ux * lateral * dt;

  const bx = bomb.x, by = bomb.y;
  clampToRect(bomb, bounds);
  if (bx !== bomb.x || by !== bomb.y) pickWanderTarget(bomb, bounds, rng);
}

/** Pushes overlapping floor bombs apart so every bomb stays selectable. */
export function separate(bombs: readonly Bomb[], dtMs: number, bounds: Rect, radius: number = RULES.bombRadius): void {
  const minDist = radius * 1.7;
  const strength = Math.min(1, dtMs / 120);
  for (let i = 0; i < bombs.length; i++) {
    const a = bombs[i];
    if (a.state !== 'active') continue;
    for (let j = i + 1; j < bombs.length; j++) {
      const b = bombs[j];
      if (b.state !== 'active') continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= minDist) continue;
      if (d < 0.001) { dx = 1; dy = 0; d = 1; }
      const push = ((minDist - d) / 2) * strength;
      const ux = dx / d, uy = dy / d;
      a.x -= ux * push; a.y -= uy * push;
      b.x += ux * push; b.y += uy * push;
    }
  }
  for (const b of bombs) if (b.state === 'active') {
    const inside = b.x >= bounds.x && b.x <= bounds.x + bounds.w && b.y >= bounds.y && b.y <= bounds.y + bounds.h;
    if (inside) clampToRect(b, bounds);
  }
}
