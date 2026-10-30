import { describe, expect, it } from 'vitest';
import { RULES } from '../src/config/gameConfig';
import { computeSummary, createZones } from '../src/logic/scoring';
import { activeBomb, quietSession, sortInto, sortMany, step } from './helpers';

describe('collection and scoring', () => {
  it('15: zones count only correctly sorted bombs', () => {
    const s = quietSession();
    sortMany(s, 'ember', 3);
    const b = activeBomb(s, 'ember');
    const f = s.layout.floor;
    s.grab(b.id, b.x, b.y, 1);
    s.release(1, f.x + 100, f.y + 100);
    expect(s.zones.ember.pending).toBe(3);
    expect(s.zones.midnight.pending).toBe(0);
  });

  it('16-18: reaching the threshold collects exactly 40 into the secured score and clears the zone', () => {
    const s = quietSession();
    sortMany(s, 'ember', RULES.collectionThreshold - 1);
    expect(s.zones.ember.pending).toBe(39);
    expect(s.securedBombs).toBe(0);
    s.drainEvents();
    sortMany(s, 'ember', 1);
    const collected = s.drainEvents().filter((e) => e.type === 'collected');
    expect(collected).toEqual([{ type: 'collected', zone: 'ember', amount: 40, secured: 40 }]);
    expect(s.securedBombs).toBe(40);
    expect(s.zones.ember.pending).toBe(0);
    expect(s.zones.ember.collections).toBe(1);
  });

  it('19: other zones keep their pending counts when one collects', () => {
    const s = quietSession();
    sortMany(s, 'midnight', 11);
    sortMany(s, 'ember', 40);
    expect(s.zones.midnight.pending).toBe(11);
    expect(s.zones.ember.pending).toBe(0);
  });

  it('20: collection does not pause other fuses', () => {
    const s = quietSession();
    sortMany(s, 'ember', 39);
    const waiting = activeBomb(s, 'midnight');
    const last = activeBomb(s, 'ember');
    const before = waiting.fuseRemainingMs;
    sortInto(s, last, 'ember');
    step(s, 1000);
    expect(waiting.fuseRemainingMs).toBeCloseTo(before - 1000, -1);
    expect(s.state).toBe('running');
  });

  it('collection keeps the level and spawn schedule (no reset)', () => {
    const s = quietSession({ startLevel: 4 });
    sortMany(s, 'ember', 40);
    expect(s.level).toBeGreaterThanOrEqual(4);
    expect(s.state).toBe('running');
  });

  it('10: secured score is preserved after a later explosion in the same zone', () => {
    const s = quietSession();
    sortMany(s, 'ember', 45);
    const bad = activeBomb(s, 'midnight');
    sortInto(s, bad, 'ember');
    expect(s.summary).toMatchObject({ securedBombs: 40, lostBombs: 5, finalScore: 40 });
  });

  it('21: the final breakdown never double counts (secured + survivors + lost = sorted)', () => {
    const s = quietSession();
    sortMany(s, 'ember', 52);
    sortMany(s, 'midnight', 17);
    const bad = activeBomb(s, 'ember');
    sortInto(s, bad, 'midnight');
    const sum = s.summary!;
    expect(sum.securedBombs + sum.survivorBombs + sum.lostBombs).toBe(sum.totalSorted);
    expect(sum.totalSorted).toBe(69);
    expect(sum.finalScore).toBe(sum.securedBombs + sum.bonusPoints + sum.survivorBombs);
  });

  it('computeSummary handles fuse failures (no zone lost)', () => {
    const zones = createZones();
    zones.ember.pending = 3;
    zones.moss.pending = 2;
    const sum = computeSummary({
      cause: 'fuseExpired', bombCategory: 'aqua', detonatedZone: null, zones,
      securedBombs: 80, bonusPoints: 10, levelReached: 15, totalSorted: 85, durationMs: 1,
    });
    expect(sum).toMatchObject({ survivorBombs: 5, lostBombs: 0, finalScore: 95, totalExplosions: 1 });
  });
});
