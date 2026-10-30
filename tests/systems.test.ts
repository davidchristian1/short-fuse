import { describe, expect, it } from 'vitest';
import { RULES } from '../src/config/gameConfig';
import { canTransition, createBomb, transition } from '../src/logic/bomb';
import { getDifficulty } from '../src/logic/difficulty';
import { GameSession } from '../src/logic/GameSession';
import { CATEGORY_ORDER } from '../src/config/categories';
import { computeLayout, rectContains, remapPoint, walkBounds, zoneAt } from '../src/logic/layout';
import { seededRng } from '../src/logic/rng';
import { SpawnScheduler } from '../src/logic/spawner';
import { loadBestScore, loadSettings, submitScore, type StorageLike } from '../src/storage/persistence';
import { activeBomb, quietSession, step, zoneCenter } from './helpers';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}

describe('bomb state machine', () => {
  it('rejects illegal transitions', () => {
    const b = createBomb({ id: 1, category: 'ember', special: null, doorId: 0, fuseMs: 9000, speedMul: 1, fromX: 0, fromY: 0, toX: 0, toY: 0, spawnMs: 500 });
    expect(b.state).toBe('spawning');
    expect(transition(b, 'sorted')).toBe(false);
    expect(transition(b, 'dragging')).toBe(false);
    expect(transition(b, 'active')).toBe(true);
    expect(transition(b, 'dragging')).toBe(true);
    expect(transition(b, 'sorted')).toBe(true);
    expect(transition(b, 'exploding')).toBe(false);
    expect(transition(b, 'active')).toBe(false);
    expect(canTransition('exploding', 'sorted')).toBe(false);
    expect(canTransition('removed', 'active')).toBe(false);
  });

  it('fuse starts only once the bomb reaches the floor', () => {
    const s = quietSession();
    const b = s.spawnNow({ doorId: 0, category: 'ember', special: null });
    step(s, RULES.spawnWalkMs - 50);
    expect(b.state).toBe('spawning');
    expect(b.fuseRemainingMs).toBe(b.fuseMs);
    expect(s.grab(b.id, b.x, b.y, 1)).toBe(false);
    step(s, 100);
    expect(b.state).toBe('active');
    expect(b.fuseRunning).toBe(true);
  });
});

describe('input and pause behavior', () => {
  it('34: a grabbed bomb keeps its pointer offset (no jump to the cursor)', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    const startX = b.x, startY = b.y;
    s.grab(b.id, startX + 15, startY - 10, 1);
    s.moveDrag(1, startX + 15, startY - 10);
    expect(b.x).toBeCloseTo(startX);
    expect(b.y).toBeCloseTo(startY);
    s.moveDrag(1, startX + 65, startY + 40);
    expect(b.x).toBeCloseTo(startX + 50);
    expect(b.y).toBeCloseTo(startY + 50);
  });

  it('35: the fuse keeps burning while dragging', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    s.grab(b.id, b.x, b.y, 1);
    const before = b.fuseRemainingMs;
    step(s, 1000);
    expect(b.state).toBe('dragging');
    expect(b.fuseRemainingMs).toBeCloseTo(before - 1000, -1);
  });

  it('36: releasing outside every zone returns the bomb to the floor with its fuse running', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    s.grab(b.id, b.x, b.y, 1);
    s.moveDrag(1, s.layout.width / 2, 20); // over the HUD
    expect(s.release(1)).toBe('returned');
    expect(b.state).toBe('active');
    const fuse = b.fuseRemainingMs;
    step(s, 1500);
    const bounds = walkBounds(s.layout);
    expect(rectContains(bounds, b.x, b.y, 1)).toBe(true);
    expect(b.fuseRemainingMs).toBeLessThan(fuse);
  });

  it('a pointer can only hold one bomb, and two pointers can hold two', () => {
    const s = quietSession();
    const a = activeBomb(s, 'ember');
    const b = activeBomb(s, 'midnight');
    expect(s.grab(a.id, a.x, a.y, 1)).toBe(true);
    expect(s.grab(b.id, b.x, b.y, 1)).toBe(false);
    expect(s.grab(b.id, b.x, b.y, 2)).toBe(true);
    expect(s.grab(a.id, a.x, a.y, 3)).toBe(false);
    const ce = zoneCenter(s, 'ember'), cm = zoneCenter(s, 'midnight');
    expect(s.release(2, cm.x, cm.y)).toBe('sorted');
    expect(s.release(1, ce.x, ce.y)).toBe('sorted');
  });

  it('38-39: pause freezes fuses, movement, spawning and levels; resume continues', () => {
    const s = new GameSession({ rng: seededRng(9), firstSpawnDelayMs: 0 });
    s.start();
    step(s, 1500);
    const b = s.bombs.find((x) => x.state === 'active')!;
    s.grab(b.id, b.x, b.y, 1);
    expect(s.pause()).toBe(true);
    expect(b.state).toBe('active'); // drag cancelled, bomb kept on the floor
    const snapshot = JSON.stringify(s.bombs.map((x) => [x.id, x.x, x.y, x.fuseRemainingMs, x.state]));
    const lvl = s.levelElapsedMs, count = s.bombs.length;
    step(s, 30_000);
    expect(JSON.stringify(s.bombs.map((x) => [x.id, x.x, x.y, x.fuseRemainingMs, x.state]))).toBe(snapshot);
    expect(s.levelElapsedMs).toBe(lvl);
    expect(s.bombs.length).toBe(count);
    expect(s.grab(b.id, b.x, b.y, 1)).toBe(false);
    expect(s.resume()).toBe(true);
    step(s, 500);
    expect(b.fuseRemainingMs).toBeLessThan(b.fuseMs);
    expect(s.levelElapsedMs).toBeGreaterThan(lvl);
  });

  it('picks the top-most overlapping bomb and ignores spawning ones', () => {
    const s = quietSession();
    const a = activeBomb(s, 'ember');
    const b = activeBomb(s, 'midnight');
    b.x = a.x;
    b.y = a.y;
    expect(s.pickBombAt(a.x, a.y)?.id).toBe(b.id);
    const spawning = s.spawnNow({ doorId: 0, category: 'ember', special: null });
    spawning.x = a.x;
    spawning.y = a.y;
    expect(s.pickBombAt(a.x, a.y)?.id).toBe(b.id);
  });

  it('setOrientation remaps bombs onto the new floor and cancels drags', () => {
    const s = quietSession();
    const b = activeBomb(s, 'ember');
    s.grab(b.id, b.x, b.y, 1);
    expect(b.state).toBe('dragging');
    const old = s.layout;
    s.setOrientation('portrait');
    expect(s.layout.orientation).toBe('portrait');
    expect(b.state).toBe('active');
    expect(s.layout.width).not.toBe(old.width);
    const bounds = walkBounds(s.layout);
    expect(rectContains(bounds, b.x, b.y, RULES.bombRadius)).toBe(true);
  });

  it('40: a fresh session resets all run state', () => {
    const a = quietSession();
    activeBomb(a, 'ember');
    a.setLevel(12);
    const b = quietSession();
    expect(b.level).toBe(1);
    expect(b.bombs).toHaveLength(0);
    expect(b.securedBombs + b.bonusPoints + b.totalSorted).toBe(0);
    expect(CATEGORY_ORDER.every((c) => b.zones[c].pending === 0)).toBe(true);
  });
});

describe('layout and hit detection', () => {
  for (const orientation of ['landscape', 'portrait'] as const) {
    it(`37: zones are hit reliably and never overlap the floor (${orientation})`, () => {
      for (const n of [2, 3, 4]) {
        const layout = computeLayout(orientation, CATEGORY_ORDER.slice(0, n));
        const ids = Object.keys(layout.zones);
        expect(ids).toHaveLength(n);
        for (const [id, r] of Object.entries(layout.zones)) {
          expect(zoneAt(layout, r!.x + r!.w / 2, r!.y + r!.h / 2)).toBe(id);
          expect(zoneAt(layout, r!.x + 2, r!.y + 2)).toBe(id);
          expect(r!.x).toBeGreaterThanOrEqual(0);
          expect(r!.x + r!.w).toBeLessThanOrEqual(layout.width);
          expect(r!.y + r!.h).toBeLessThanOrEqual(layout.height);
        }
        const f = layout.floor;
        expect(zoneAt(layout, f.x + f.w / 2, f.y + f.h / 2)).toBeNull();
        const wb = walkBounds(layout);
        for (const [x, y] of [[wb.x, wb.y], [wb.x + wb.w, wb.y + wb.h], [wb.x, wb.y + wb.h], [wb.x + wb.w, wb.y]]) {
          expect(zoneAt(layout, x, y, 0)).toBeNull();
        }
        // door exits stay out of the zones
        for (const d of layout.doors) expect(zoneAt(layout, d.exitX, d.exitY)).toBeNull();
      }
    });
  }

  it('zone positions are stable when new categories unlock (same side)', () => {
    const two = computeLayout('landscape', ['ember', 'midnight']);
    const four = computeLayout('landscape', CATEGORY_ORDER);
    expect(four.zones.ember!.x).toBe(two.zones.ember!.x);
    expect(four.zones.midnight!.x).toBe(two.zones.midnight!.x);
  });

  it('portrait bins stay large enough for fingers, including all four colors', () => {
    for (const n of [2, 3, 4]) {
      const layout = computeLayout('portrait', CATEGORY_ORDER.slice(0, n));
      expect(layout.pickRadius).toBeGreaterThanOrEqual(60);
      expect(layout.chromeSize).toBeGreaterThanOrEqual(64);
      for (const r of Object.values(layout.zones)) {
        expect(r!.w).toBeGreaterThanOrEqual(300);
        expect(r!.h).toBeGreaterThanOrEqual(180);
      }
    }
    const four = computeLayout('portrait', CATEGORY_ORDER);
    expect(four.zones.ember!.x).toBeLessThan(four.zones.midnight!.x);
    expect(four.zones.ember!.y).toBeLessThan(four.zones.aqua!.y);
    expect(four.zones.midnight!.y).toBeLessThan(four.zones.moss!.y);
  });

  it('remaps a floor point onto a new orientation', () => {
    const land = computeLayout('landscape', CATEGORY_ORDER.slice(0, 2));
    const port = computeLayout('portrait', CATEGORY_ORDER.slice(0, 2));
    const mid = remapPoint(land.floor.x + land.floor.w / 2, land.floor.y + land.floor.h / 2, land.floor, port.floor);
    expect(mid.x).toBeCloseTo(port.floor.x + port.floor.w / 2);
    expect(mid.y).toBeCloseTo(port.floor.y + port.floor.h / 2);
  });
});

describe('spawn scheduler', () => {
  it('dumps 1 bomb at a time before volleys unlock', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const diff = getDifficulty(level);
      expect(diff.maxVolley).toBe(1);
      const sched = new SpawnScheduler(seededRng(level), 0);
      for (let t = 0; t < 40_000; t += 16) {
        const reqs = sched.update(16, diff, 0);
        const byDoor = [0, 0];
        for (const r of reqs) byDoor[r.doorId]++;
        expect(byDoor[0]).toBeLessThanOrEqual(1);
        expect(byDoor[1]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('uneven-dump phase uses 2-1 and 1-1 waves with a slower door pace', () => {
    const before = getDifficulty(5);
    const diff = getDifficulty(6);
    expect(diff.dumpPrimary).toBe(2);
    expect(diff.dumpPartner).toBe(1);
    expect(diff.simultaneousChance).toBeGreaterThan(0.8);
    expect(diff.spawnIntervalMs).toBeGreaterThan(before.spawnIntervalMs);
    const sched = new SpawnScheduler(seededRng(6), 0);
    let both = 0;
    let twoOne = 0;
    let oneOne = 0;
    let lastDump = -Infinity;
    let minGap = Infinity;
    for (let t = 0; t < 120_000; t += 16) {
      const reqs = sched.update(16, diff, 0);
      if (!reqs.length) continue;
      const byDoor = [0, 0];
      for (const r of reqs) byDoor[r.doorId]++;
      expect(Math.max(byDoor[0], byDoor[1])).toBeLessThanOrEqual(2);
      if (byDoor[0] > 0 && byDoor[1] > 0) {
        both++;
        if ((byDoor[0] === 2 && byDoor[1] === 1) || (byDoor[0] === 1 && byDoor[1] === 2)) twoOne++;
        if (byDoor[0] === 1 && byDoor[1] === 1) oneOne++;
      }
      if (lastDump >= 0) minGap = Math.min(minGap, t - lastDump);
      lastDump = t;
    }
    expect(both).toBeGreaterThan(8);
    expect(twoOne).toBeGreaterThan(3);
    expect(oneOne).toBeGreaterThan(1);
    expect(minGap).toBeGreaterThanOrEqual(RULES.minDumpIntervalMs - 16);
    expect(minGap).toBeGreaterThan(before.spawnIntervalMs * 0.9);
  });

  it('can dump several bombs from one door, and both doors on the same beat', () => {
    const diff = getDifficulty(40);
    expect(diff.maxVolley).toBe(3);
    const sched = new SpawnScheduler(seededRng(20), 0);
    let total = 0;
    let multiDoor = 0;
    let bothDoors = 0;
    let lastDump = -Infinity;
    for (let t = 0; t < 120_000; t += 16) {
      const reqs = sched.update(16, diff, 0);
      if (!reqs.length) continue;
      const byDoor = [0, 0];
      for (const r of reqs) {
        expect(diff.categories).toContain(r.category);
        byDoor[r.doorId]++;
        total++;
      }
      expect(byDoor[0]).toBeLessThanOrEqual(RULES.maxVolleyPerDoor);
      expect(byDoor[1]).toBeLessThanOrEqual(RULES.maxVolleyPerDoor);
      if (byDoor[0] >= 2 || byDoor[1] >= 2) multiDoor++;
      if (byDoor[0] > 0 && byDoor[1] > 0) bothDoors++;
      if (lastDump >= 0) expect(t - lastDump).toBeGreaterThanOrEqual(RULES.minDumpIntervalMs - 16);
      lastDump = t;
    }
    expect(total).toBeGreaterThan(40);
    expect(multiDoor).toBeGreaterThan(5);
    expect(bothDoors).toBeGreaterThan(2);
  });

  it('never lets a door dump more than its max volley', () => {
    for (const level of [2, 5, 6, 7, 10, 20, 200]) {
      const diff = getDifficulty(level);
      const sched = new SpawnScheduler(seededRng(level), 0);
      for (let t = 0; t < 40_000; t += 16) {
        const reqs = sched.update(16, diff, 0);
        const byDoor = [0, 0];
        for (const r of reqs) byDoor[r.doorId]++;
        expect(byDoor[0]).toBeLessThanOrEqual(Math.min(diff.maxVolley, RULES.maxVolleyPerDoor));
        expect(byDoor[1]).toBeLessThanOrEqual(Math.min(diff.maxVolley, RULES.maxVolleyPerDoor));
        expect(byDoor[0] + byDoor[1]).toBeLessThanOrEqual(diff.maxActiveBombs);
      }
    }
  });

  it('uses both doors once the second opens, and only door 0 before that', () => {
    const counts = (level: number) => {
      const s = new SpawnScheduler(seededRng(5), 0);
      const c = [0, 0];
      for (let t = 0; t < 200_000; t += 16) for (const r of s.update(16, getDifficulty(level), 0)) c[r.doorId]++;
      return c;
    };
    expect(counts(1)[1]).toBe(0);
    const c8 = counts(3);
    expect(c8[0]).toBeGreaterThan(10);
    expect(c8[1]).toBeGreaterThan(10);
  });

  it('holds spawns at the active-bomb cap', () => {
    const diff = getDifficulty(1);
    const s = new SpawnScheduler(seededRng(2), 0);
    let n = 0;
    for (let t = 0; t < 60_000; t += 16) n += s.update(16, diff, diff.maxActiveBombs).length;
    expect(n).toBe(0);
  });

  it('only introduces special bombs once unlocked', () => {
    const s = new SpawnScheduler(seededRng(4), 0);
    for (let t = 0; t < 200_000; t += 16) for (const r of s.update(16, getDifficulty(8), 0)) expect(r.special).toBeNull();
    let specials = 0;
    const s2 = new SpawnScheduler(seededRng(4), 0);
    for (let t = 0; t < 200_000; t += 16) for (const r of s2.update(16, getDifficulty(30), 0)) if (r.special) specials++;
    expect(specials).toBeGreaterThan(0);
  });
});

describe('persistence', () => {
  it('loads 0 for missing, invalid, or unavailable storage', () => {
    expect(loadBestScore(null)).toBe(0);
    expect(loadBestScore(memoryStorage())).toBe(0);
    expect(loadBestScore(memoryStorage({ 'short-fuse:best': 'banana' }))).toBe(0);
    expect(loadBestScore(memoryStorage({ 'short-fuse:best': '-4' }))).toBe(0);
    const throwing: StorageLike = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadBestScore(throwing)).toBe(0);
    expect(submitScore(10, throwing)).toBe(true);
  });

  it('only stores improved scores', () => {
    const st = memoryStorage();
    expect(submitScore(50, st)).toBe(true);
    expect(submitScore(20, st)).toBe(false);
    expect(loadBestScore(st)).toBe(50);
    expect(submitScore(51, st)).toBe(true);
    expect(loadBestScore(st)).toBe(51);
  });

  it('sanitizes corrupted settings', () => {
    const st = memoryStorage({ 'short-fuse:settings': '{"volume": 7, "muted": "yes"}' });
    const s = loadSettings(st);
    expect(s.volume).toBe(1);
    expect(s.muted).toBe(false);
    expect(loadSettings(memoryStorage({ 'short-fuse:settings': '{not json' })).volume).toBe(0.7);
  });
});
