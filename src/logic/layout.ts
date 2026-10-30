import { RULES } from '../config/gameConfig';
import type { CategoryId } from '../config/categories';

export type Orientation = 'landscape' | 'portrait';
export type DoorId = 0 | 1;

export interface Rect { x: number; y: number; w: number; h: number }

export interface DoorSlot {
  id: DoorId;
  /** Center of the door artwork. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where a bomb first appears (inside the door mouth). */
  exitX: number;
  exitY: number;
}

export interface Layout {
  orientation: Orientation;
  width: number;
  height: number;
  hud: Rect;
  /** Walkable area. Bomb centers stay inside this rect inset by the bomb radius. */
  floor: Rect;
  doors: readonly [DoorSlot, DoorSlot];
  zones: Partial<Record<CategoryId, Rect>>;
  bombSize: number;
  /** Finger-friendly grab radius used by pickBombAt. */
  pickRadius: number;
  /** Extra drop forgiveness around each zone. */
  zoneHitMargin: number;
  /** Pause / mute button size in logical pixels. */
  chromeSize: number;
}

export const LOGICAL_SIZE: Record<Orientation, { width: number; height: number }> = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
};

export function orientationFor(viewportW: number, viewportH: number): Orientation {
  return viewportH > viewportW * 1.1 ? 'portrait' : 'landscape';
}

function stackColumn(
  zones: Partial<Record<CategoryId, Rect>>,
  ids: CategoryId[],
  x: number,
  y0: number,
  colW: number,
  totalH: number,
  gap: number,
): void {
  if (!ids.length) return;
  if (ids.length === 1) {
    zones[ids[0]] = { x, y: y0, w: colW, h: totalH };
    return;
  }
  const h = (totalH - gap * (ids.length - 1)) / ids.length;
  ids.forEach((id, i) => { zones[id] = { x, y: y0 + i * (h + gap), w: colW, h }; });
}

/**
 * Zones keep a stable side/slot as more categories unlock:
 * Ember and Aqua live on the left, Midnight and Moss on the right.
 * Portrait uses a 2×2 grid so four bins stay finger-sized on a phone.
 */
export function computeLayout(orientation: Orientation, categories: readonly CategoryId[]): Layout {
  const { width, height } = LOGICAL_SIZE[orientation];
  const has = (c: CategoryId) => categories.includes(c);
  const zones: Partial<Record<CategoryId, Rect>> = {};
  const gap = 12;
  const leftIds = (['ember', 'aqua'] as CategoryId[]).filter(has);
  const rightIds = (['midnight', 'moss'] as CategoryId[]).filter(has);

  if (orientation === 'landscape') {
    const hud: Rect = { x: 0, y: 0, w: width, h: 80 };
    const colW = 236;
    const top = 90;
    const bottom = height - 10;
    stackColumn(zones, leftIds, 10, top, colW, bottom - top, gap);
    stackColumn(zones, rightIds, width - 10 - colW, top, colW, bottom - top, gap);
    const floor: Rect = { x: 10 + colW + 14, y: 210, w: width - 2 * (10 + colW + 14), h: bottom - 210 };
    const doorW = 164, doorH = 148;
    const mk = (id: DoorId, fx: number): DoorSlot => {
      const x = floor.x + floor.w * fx;
      return { id, x, y: 82 + doorH / 2, width: doorW, height: doorH, exitX: x, exitY: 82 + doorH - 34 };
    };
    return {
      orientation, width, height, hud, floor, doors: [mk(0, 0.3), mk(1, 0.7)], zones,
      bombSize: 92, pickRadius: 48, zoneHitMargin: 12, chromeSize: 52,
    };
  }

  const hud: Rect = { x: 0, y: 0, w: width, h: 100 };
  const margin = 12;
  const zoneBlockH = 420;
  const zoneTop = height - margin - zoneBlockH;
  const colW = (width - margin * 2 - gap) / 2;
  stackColumn(zones, leftIds, margin, zoneTop, colW, zoneBlockH, gap);
  stackColumn(zones, rightIds, margin + colW + gap, zoneTop, colW, zoneBlockH, gap);
  const doorW = 168, doorH = 152;
  const doorTop = hud.h + 6;
  const floor: Rect = { x: 16, y: doorTop + doorH - 24, w: width - 32, h: zoneTop - 16 - (doorTop + doorH - 24) };
  const mk = (id: DoorId, fx: number): DoorSlot => {
    const x = floor.x + floor.w * fx;
    return { id, x, y: doorTop + doorH / 2, width: doorW, height: doorH, exitX: x, exitY: doorTop + doorH - 28 };
  };
  return {
    orientation, width, height, hud, floor, doors: [mk(0, 0.3), mk(1, 0.7)], zones,
    bombSize: 108, pickRadius: 64, zoneHitMargin: 28, chromeSize: 72,
  };
}

export function rectContains(r: Rect, x: number, y: number, margin = 0): boolean {
  return x >= r.x - margin && x <= r.x + r.w + margin && y >= r.y - margin && y <= r.y + r.h + margin;
}

/**
 * Returns the zone a release point lands in. Exact containment wins; otherwise the
 * nearest zone whose forgiving margin contains the point. Null means "back to the floor".
 */
export function zoneAt(layout: Layout, x: number, y: number, margin: number = layout.zoneHitMargin): CategoryId | null {
  let best: CategoryId | null = null;
  let bestDist = Infinity;
  for (const [id, r] of Object.entries(layout.zones) as [CategoryId, Rect][]) {
    if (rectContains(r, x, y)) return id;
    if (rectContains(r, x, y, margin)) {
      const d = Math.hypot(x - (r.x + r.w / 2), y - (r.y + r.h / 2));
      if (d < bestDist) { bestDist = d; best = id; }
    }
  }
  return best;
}

/** Inner rect that bomb centers must stay within. */
export function walkBounds(layout: Layout, radius: number = RULES.bombRadius): Rect {
  const f = layout.floor;
  return { x: f.x + radius, y: f.y + radius * 0.6, w: f.w - radius * 2, h: f.h - radius * 1.6 };
}

/** Maps a point from one floor rect onto another (used on orientation change). */
export function remapPoint(x: number, y: number, from: Rect, to: Rect): { x: number; y: number } {
  const sx = from.w === 0 ? 0 : (x - from.x) / from.w;
  const sy = from.h === 0 ? 0 : (y - from.y) / from.h;
  return { x: to.x + sx * to.w, y: to.y + sy * to.h };
}
