import { describe, expect, it } from 'vitest';
import { RULES } from '../src/config/gameConfig';
import { CATEGORY_ORDER } from '../src/config/categories';
import { DIFFICULTY_TUNING as T, evalCurve, getDifficulty, unlocksAtLevel } from '../src/logic/difficulty';
import { GameSession } from '../src/logic/GameSession';
import { seededRng } from '../src/logic/rng';

const LEVELS = [...Array.from({ length: 150 }, (_, i) => i + 1), 200, 500, 1000, 10_000, 1e6];

describe('endless difficulty', () => {
  it('starts with 2 categories and 1 door', () => {
    const d = getDifficulty(1);
    expect(d.categories).toEqual(['ember', 'midnight']);
    expect(d.activeDoors).toBe(1);
    expect(d.specialTypes).toEqual([]);
  });

  it('22-24: milestones unlock in order: second door, then third, then fourth category', () => {
    const firstLevel = (pred: (l: number) => boolean) => LEVELS.find(pred)!;
    const door2 = firstLevel((l) => getDifficulty(l).activeDoors === 2);
    const third = firstLevel((l) => getDifficulty(l).categories.length === 3);
    const fourth = firstLevel((l) => getDifficulty(l).categories.length === 4);
    expect(door2).toBe(T.secondDoorLevel);
    expect(third).toBe(T.thirdCategoryLevel);
    expect(fourth).toBe(T.fourthCategoryLevel);
    expect(door2).toBeGreaterThan(1);
    expect(third).toBeGreaterThan(door2);
    expect(fourth).toBeGreaterThan(third);
    expect(getDifficulty(third).categories).toEqual(['ember', 'midnight', 'aqua']);
    // special bombs only appear after all four categories are in play
    const firstSpecial = firstLevel((l) => getDifficulty(l).specialTypes.length > 0);
    expect(firstSpecial).toBeGreaterThan(fourth + 2);
  });

  it('25-26, 28-31: every level (including 100+, 10k, 1M) yields a valid bounded config', () => {
    for (const l of LEVELS) {
      const d = getDifficulty(l);
      expect(d.level).toBe(l);
      expect(d.activeDoors).toBeLessThanOrEqual(RULES.maxDoors);
      expect(d.categories.length).toBeLessThanOrEqual(RULES.maxCategories);
      for (const c of d.categories) expect(CATEGORY_ORDER).toContain(c);
      expect(Number.isFinite(d.spawnIntervalMs)).toBe(true);
      expect(d.spawnIntervalMs).toBeGreaterThanOrEqual(RULES.minDumpIntervalMs);
      expect(d.maxVolley).toBeGreaterThanOrEqual(1);
      expect(d.maxVolley).toBeLessThanOrEqual(RULES.maxVolleyPerDoor);
      expect(d.simultaneousChance).toBeGreaterThanOrEqual(0);
      expect(d.simultaneousChance).toBeLessThanOrEqual(0.95);
      expect(d.levelDurationMs).toBeGreaterThanOrEqual(12_000);
      expect(d.levelDurationMs).toBeLessThanOrEqual(32_000);
      expect(d.fuseMs).toBeGreaterThanOrEqual(RULES.minFuseMs);
      expect(d.fuseMs).toBeLessThanOrEqual(10_500);
      expect(d.maxActiveBombs).toBeGreaterThanOrEqual(1);
      expect(d.maxActiveBombs).toBeLessThanOrEqual(RULES.maxActiveHardCap);
      expect(d.moveSpeed).toBeGreaterThan(0);
      expect(d.moveSpeed).toBeLessThan(100);
      expect(d.specialChance).toBeLessThanOrEqual(0.3);
      expect(d.trajectoryComplexity).toBeLessThanOrEqual(1);
      expect(d.wanderPauseMs[0]).toBeGreaterThan(0);
      expect(d.wanderPauseMs[1]).toBeGreaterThan(d.wanderPauseMs[0]);
    }
  });

  it('27: the spawn-interval curve decreases with level (outside of brief post-unlock relief)', () => {
    let prev = Infinity;
    for (let l = 1; l <= 300; l++) {
      const base = evalCurve(T.spawnIntervalMs, l);
      expect(base).toBeLessThanOrEqual(prev);
      prev = base;
    }
    expect(getDifficulty(1).spawnIntervalMs).toBeGreaterThanOrEqual(1400);
    expect(getDifficulty(1).spawnIntervalMs).toBeLessThanOrEqual(1800);
    expect(getDifficulty(1).fuseMs).toBeGreaterThanOrEqual(7800);
    expect(getDifficulty(1).fuseMs).toBeLessThanOrEqual(8600);
    expect(getDifficulty(1).maxVolley).toBe(1);
    expect(getDifficulty(1).activeDoors).toBe(1);
    expect(getDifficulty(2).activeDoors).toBe(2);
    expect(getDifficulty(1).levelDurationMs).toBeLessThan(getDifficulty(2).levelDurationMs);
    expect(getDifficulty(5).simultaneousChance).toBeGreaterThan(0.7);
    expect(getDifficulty(5).maxVolley).toBe(1);
    expect(getDifficulty(6).spawnIntervalMs).toBeGreaterThan(getDifficulty(5).spawnIntervalMs);
    expect(getDifficulty(20).maxVolley).toBe(3);
    expect(getDifficulty(20).spawnIntervalMs).toBeGreaterThanOrEqual(1800);
    expect(getDifficulty(100).maxVolley).toBe(3);
    expect(getDifficulty(100).spawnIntervalMs).toBeLessThan(getDifficulty(T.endlessLevel).spawnIntervalMs);
  });

  it('applies relief right after a new category, then ramps again', () => {
    const at = getDifficulty(T.thirdCategoryLevel);
    const after = getDifficulty(T.thirdCategoryLevel + T.relief.levels);
    expect(at.relief).toBe(true);
    expect(at.newCategory).toBe('aqua');
    expect(after.newCategory).not.toBe('aqua');
  });

  it('keeps evolving past the endless stage (no fixed final configuration)', () => {
    const a = getDifficulty(T.endlessLevel), b = getDifficulty(60), c = getDifficulty(120);
    expect(b.spawnIntervalMs).toBeLessThan(a.spawnIntervalMs);
    expect(c.spawnIntervalMs).toBeLessThan(b.spawnIntervalMs);
    expect(c.maxActiveBombs).toBeGreaterThanOrEqual(a.maxActiveBombs);
    const patterns = new Set(Array.from({ length: 30 }, (_, i) => getDifficulty(T.endlessLevel + i).pattern));
    expect(patterns.size).toBeGreaterThanOrEqual(4);
  });

  it('unlocks 2-, then 3-bomb door dumps, never more than three per door', () => {
    expect(getDifficulty(T.secondDoorLevel).maxVolley).toBe(1);
    expect(getDifficulty(T.fourthCategoryLevel).maxVolley).toBe(1);
    expect(getDifficulty(T.volley2Level - 1).maxVolley).toBe(1);
    expect(getDifficulty(T.volley2Level).maxVolley).toBe(2);
    expect(getDifficulty(T.volley2Level).dumpPrimary).toBe(2);
    expect(getDifficulty(T.volley2Level).dumpPartner).toBe(1);
    expect(getDifficulty(T.volley22Level).dumpPrimary).toBe(2);
    expect(getDifficulty(T.volley22Level).dumpPartner).toBe(2);
    expect(getDifficulty(T.volley3Level).maxVolley).toBe(3);
    expect(getDifficulty(T.volley3Level).dumpPartner).toBe(2);
    expect(getDifficulty(T.volley33Level).dumpPrimary).toBe(3);
    expect(getDifficulty(T.volley33Level).dumpPartner).toBe(3);
    expect(getDifficulty(100).maxVolley).toBe(3);
    expect(getDifficulty(1).simultaneousChance).toBe(0);
    expect(getDifficulty(T.secondDoorLevel).simultaneousChance).toBeGreaterThan(0);
    expect(getDifficulty(T.volley2Level).simultaneousChance).toBeGreaterThan(getDifficulty(T.secondDoorLevel).simultaneousChance);
  });

  it('announces each unlock exactly once', () => {
    const all = Array.from({ length: 60 }, (_, i) => unlocksAtLevel(i + 1)).flat();
    const ids = all.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['door2', 'aqua', 'moss', 'volley2', 'volley22', 'volley3', 'volley33', 'shortFuse', 'speedy', 'heavy', 'bonus']);
  });

  it('handles invalid level input safely', () => {
    expect(getDifficulty(0).level).toBe(1);
    expect(getDifficulty(-5).level).toBe(1);
    expect(getDifficulty(Number.NaN).level).toBe(1);
  });

  it('31: a session keeps advancing levels with no campaign limit', () => {
    const s = new GameSession({ rng: seededRng(1), firstSpawnDelayMs: 1e12, startLevel: 98 });
    s.start();
    const dur = getDifficulty(98).levelDurationMs;
    for (let i = 0; i < (dur * 4) / 50; i++) s.update(50);
    expect(s.level).toBe(102);
    expect(s.state).toBe('running');
    expect(Object.keys(s.layout.zones)).toHaveLength(4);
  });

  it('29: the active-bomb count never exceeds the configured limit in a long simulated run', () => {
    for (const startLevel of [1, 8, 15, 30, 120]) {
      const s = new GameSession({ rng: seededRng(startLevel), firstSpawnDelayMs: 0, startLevel });
      s.start();
      let maxSeen = 0;
      for (let i = 0; i < 3000; i++) {
        s.update(33);
        s.drainEvents();
        maxSeen = Math.max(maxSeen, s.unsortedCount);
        expect(s.unsortedCount).toBeLessThanOrEqual(s.difficulty.maxActiveBombs);
        // Sort only bombs whose fuse is low so the floor stays crowded but nothing expires.
        for (const b of [...s.bombs]) {
          if (b.state === 'active' && b.fuseRemainingMs < 1500) {
            const r = s.layout.zones[b.category]!;
            s.grab(b.id, b.x, b.y, 7);
            s.release(7, r.x + r.w / 2, r.y + r.h / 2);
          }
        }
        if (s.state !== 'running') break;
      }
      expect(s.state).toBe('running');
      expect(maxSeen).toBeGreaterThanOrEqual(Math.min(getDifficulty(startLevel).maxActiveBombs, 6));
    }
  });
});
