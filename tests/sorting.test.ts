import { describe, expect, it } from 'vitest';
import { RULES } from '../src/config/gameConfig';
import { CATEGORY_ORDER } from '../src/config/categories';
import { GameSession } from '../src/logic/GameSession';
import { seededRng } from '../src/logic/rng';
import { activeBomb, dragTo, quietSession, sortInto, sortMany, step, zoneCenter } from './helpers';

describe('core sorting rules', () => {
  it('1-2: a new run starts at level 1 with two categories, two zones, and one door', () => {
    const s = new GameSession();
    expect(s.level).toBe(1);
    expect(s.bankedScore).toBe(0);
    expect(s.activeCategories).toEqual(['ember', 'midnight']);
    expect(Object.keys(s.layout.zones).sort()).toEqual(['ember', 'midnight']);
    expect(s.difficulty.activeDoors).toBe(1);
  });

  it('3: every automatically spawned bomb has a valid, active category and an active door', () => {
    const s = new GameSession({ rng: seededRng(7), firstSpawnDelayMs: 0 });
    s.start();
    const seen = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      s.update(16);
      for (const e of s.drainEvents()) {
        if (e.type === 'spawned') {
          expect(CATEGORY_ORDER).toContain(e.bomb.category);
          expect(s.activeCategories).toContain(e.bomb.category);
          expect(e.bomb.doorId).toBeLessThan(s.difficulty.activeDoors);
          expect(seen.has(e.bomb.id)).toBe(false);
          seen.add(e.bomb.id);
        }
      }
      // keep the run alive: sort everything that is on the floor
      for (const b of [...s.bombs]) if (b.state === 'active') sortInto(s, b, b.category, 99);
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(s.state).toBe('running');
  });

  it('4-5: a correctly sorted bomb becomes safe and its fuse stops permanently', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    step(s, 1000);
    expect(sortInto(s, b, 'ember')).toBe('sorted');
    expect(b.state).toBe('sorted');
    expect(b.fuseRunning).toBe(false);
    const remaining = b.fuseRemainingMs;
    step(s, b.fuseMs * 3);
    expect(b.fuseRemainingMs).toBe(remaining);
    expect(s.state).toBe('running');
    expect(s.zones.ember.pending).toBe(1);
    expect(s.bombs).not.toContain(b);
  });

  it('6, 8: an incorrect drop ends the run and detonates the destination zone', () => {
    const s = quietSession();
    sortMany(s, 'midnight', 5);
    sortMany(s, 'ember', 3);
    const wrong = activeBomb(s, 'ember');
    expect(sortInto(s, wrong, 'midnight')).toBe('wrongZone');
    expect(s.state).toBe('over');
    expect(wrong.state).toBe('exploding');
    const events = s.drainEvents();
    const explode = events.find((e) => e.type === 'explode');
    expect(explode).toMatchObject({ cause: 'wrongZone', zone: 'midnight', chainCount: 5 });
    expect(events.filter((e) => e.type === 'gameOver')).toHaveLength(1);
  });

  it('7: an expired fuse ends the run', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    step(s, b.fuseMs + 100);
    expect(b.state).toBe('exploding');
    expect(s.state).toBe('over');
    expect(s.summary?.cause).toBe('fuseExpired');
    expect(s.summary?.detonatedZone).toBeNull();
  });

  it('9-11: lost, survivor, and secured bombs are scored per the rules', () => {
    const s = quietSession();
    sortMany(s, 'ember', RULES.collectionThreshold + 7); // 40 secured, 7 pending in ember
    sortMany(s, 'midnight', 4);
    const bad = activeBomb(s, 'midnight');
    sortInto(s, bad, 'ember');
    const sum = s.summary!;
    expect(sum.securedBombs).toBe(40);
    expect(sum.lostBombs).toBe(7);
    expect(sum.survivorBombs).toBe(4);
    expect(sum.finalScore).toBe(44);
    expect(sum.totalExplosions).toBe(8);
  });

  it('12: a bomb cannot be sorted twice', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    expect(sortInto(s, b, 'ember')).toBe('sorted');
    expect(s.grab(b.id, b.x, b.y, 1)).toBe(false);
    expect(s.release(1)).toBe('ignored');
    expect(s.zones.ember.pending).toBe(1);
    expect(s.totalSorted).toBe(1);
  });

  it('13: a bomb cannot be rescued after its fuse expires, even mid-drag', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    expect(s.grab(b.id, b.x, b.y, 1)).toBe(true);
    const c = zoneCenter(s, 'ember');
    s.moveDrag(1, c.x, c.y);
    step(s, b.fuseMs + 50); // fuse expires while the bomb hovers over its own zone
    expect(s.release(1, c.x, c.y)).toBe('ignored');
    expect(s.zones.ember.pending).toBe(0);
    expect(s.summary?.cause).toBe('fuseExpired');
  });

  it('13b: same-frame ordering - a release before the expiring update is honored', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    s.grab(b.id, b.x, b.y, 1);
    step(s, b.fuseMs - 30, 10); // 30ms left; the next 50ms frame would expire it
    expect(b.fuseRemainingMs).toBeGreaterThan(0);
    const c = zoneCenter(s, 'ember');
    expect(s.release(1, c.x, c.y)).toBe('sorted');
    s.update(50);
    expect(s.state).toBe('running');
  });

  it('14: only one game-over transition can occur per run', () => {
    const s = quietSession();
    const a = activeBomb(s, 'ember');
    const b = activeBomb(s, 'ember');
    a.fuseRemainingMs = 5;
    b.fuseRemainingMs = 5;
    s.update(16);
    s.update(16);
    expect(s.release(1)).toBe('ignored');
    const overs = s.drainEvents().filter((e) => e.type === 'gameOver' || e.type === 'explode');
    expect(overs.filter((e) => e.type === 'gameOver')).toHaveLength(1);
    expect(overs.filter((e) => e.type === 'explode')).toHaveLength(1);
    expect([a.state, b.state].filter((st) => st === 'exploding')).toHaveLength(1);
  });

  it('freezes everything after a terminal explosion', () => {
    const s = new GameSession({ rng: seededRng(3), firstSpawnDelayMs: 0 });
    s.start();
    step(s, 3000);
    const b = s.bombs.find((x) => x.state === 'active')!;
    sortInto(s, b, b.category === 'ember' ? 'midnight' : 'ember');
    expect(s.state).toBe('over');
    const count = s.bombs.length, score = s.bankedScore, elapsed = s.elapsedMs, level = s.level;
    const fuses = s.bombs.map((x) => x.fuseRemainingMs);
    step(s, 60_000);
    expect(s.bombs.length).toBe(count);
    expect(s.bankedScore).toBe(score);
    expect(s.elapsedMs).toBe(elapsed);
    expect(s.level).toBe(level);
    expect(s.bombs.map((x) => x.fuseRemainingMs)).toEqual(fuses);
    expect(s.grab(s.bombs[0].id, 0, 0, 5)).toBe(false);
  });

  it('chain reaction works with 2, 3, and 4 zones', () => {
    for (const level of [1, 10, 14]) {
      const s = quietSession({ startLevel: level });
      const cats = s.activeCategories;
      for (const c of cats) sortMany(s, c, 3);
      const target = cats[cats.length - 1];
      const bomb = activeBomb(s, cats[0]);
      sortInto(s, bomb, target);
      expect(s.summary).toMatchObject({ detonatedZone: target, lostBombs: 3, survivorBombs: 3 * (cats.length - 1) });
    }
  });

  it('bonus bombs add their bonus only when sorted correctly', () => {
    const s = quietSession({ startLevel: 24 });
    const good = activeBomb(s, 'aqua', 'bonus');
    sortInto(s, good, 'aqua');
    expect(s.bonusPoints).toBe(RULES.bonusBombPoints);
    const bad = activeBomb(s, 'aqua', 'bonus');
    sortInto(s, bad, 'moss');
    expect(s.summary?.bonusPoints).toBe(RULES.bonusBombPoints);
    // the bonus bomb itself survives as a pending aqua bomb (moss was the detonated zone)
    expect(s.summary?.finalScore).toBe(RULES.bonusBombPoints + 1);
  });

  it('short-fuse bombs have shorter (but bounded) fuses', () => {
    const s = quietSession({ startLevel: 18 });
    const normal = activeBomb(s, 'ember');
    const short = activeBomb(s, 'ember', 'shortFuse');
    expect(short.fuseMs).toBeLessThan(normal.fuseMs * 0.8);
    expect(short.fuseMs).toBeGreaterThanOrEqual(RULES.minFuseMs);
  });

  it('dragging with an offset is honored on release (drop judged at the bomb position)', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    const c = zoneCenter(s, 'ember');
    // grab 20px left of center; pointer ends 20px left of the zone center so bomb lands on the center
    expect(s.grab(b.id, b.x - 20, b.y, 1)).toBe(true);
    s.moveDrag(1, c.x - 20, c.y);
    expect(b.x).toBeCloseTo(c.x);
    expect(s.release(1)).toBe('sorted');
  });

  it('dropping on the floor is not a sort', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    const f = s.layout.floor;
    expect(dragTo(s, b, f.x + f.w / 2, f.y + f.h / 2)).toBe('returned');
    expect(b.state).toBe('active');
  });
});
