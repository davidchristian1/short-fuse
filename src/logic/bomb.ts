import type { CategoryId } from '../config/categories';
import type { SpecialType } from './difficulty';
import type { DoorId } from './layout';

export type BombState = 'spawning' | 'active' | 'dragging' | 'sorted' | 'exploding' | 'removed';

const TRANSITIONS: Readonly<Record<BombState, readonly BombState[]>> = {
  spawning: ['active', 'removed'],
  active: ['dragging', 'exploding', 'removed'],
  dragging: ['active', 'sorted', 'exploding', 'removed'],
  sorted: ['removed'],
  exploding: ['removed'],
  removed: [],
};

export interface DragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  /** Where the pointer (plus grab offset) wants the bomb to be. */
  targetX: number;
  targetY: number;
}

export interface WanderState {
  targetX: number;
  targetY: number;
  pauseMs: number;
  phase: number;
  retargetMs: number;
}

export interface Bomb {
  readonly id: number;
  readonly category: CategoryId;
  readonly special: SpecialType | null;
  state: BombState;
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly doorId: DoorId;
  readonly fuseMs: number;
  fuseRemainingMs: number;
  fuseRunning: boolean;
  drag: DragState | null;
  destinationZone: CategoryId | null;
  spawn: { fromX: number; fromY: number; toX: number; toY: number; elapsedMs: number; durationMs: number };
  wander: WanderState;
  speedMul: number;
  /** Effect bookkeeping consumed by the renderer and audio cues. */
  fx: { warned: boolean; nextTickAtMs: number };
}

export interface BombInit {
  id: number;
  category: CategoryId;
  special: SpecialType | null;
  doorId: DoorId;
  fuseMs: number;
  speedMul: number;
  fromX: number; fromY: number; toX: number; toY: number;
  spawnMs: number;
}

export function createBomb(init: BombInit): Bomb {
  return {
    id: init.id,
    category: init.category,
    special: init.special,
    state: 'spawning',
    x: init.fromX,
    y: init.fromY,
    vx: 0,
    vy: 0,
    doorId: init.doorId,
    fuseMs: init.fuseMs,
    fuseRemainingMs: init.fuseMs,
    fuseRunning: false,
    drag: null,
    destinationZone: null,
    spawn: { fromX: init.fromX, fromY: init.fromY, toX: init.toX, toY: init.toY, elapsedMs: 0, durationMs: init.spawnMs },
    wander: { targetX: init.toX, targetY: init.toY, pauseMs: 300, phase: init.id * 1.7, retargetMs: 1200 },
    speedMul: init.speedMul,
    fx: { warned: false, nextTickAtMs: 0 },
  };
}

export function canTransition(from: BombState, to: BombState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Applies a state change only if it is legal. Returns whether the change happened. */
export function transition(bomb: Bomb, to: BombState): boolean {
  if (!canTransition(bomb.state, to)) return false;
  bomb.state = to;
  return true;
}

export function fuseFraction(bomb: Bomb): number {
  return bomb.fuseMs > 0 ? Math.max(0, Math.min(1, bomb.fuseRemainingMs / bomb.fuseMs)) : 0;
}

export function isUnsorted(bomb: Bomb): boolean {
  return bomb.state === 'spawning' || bomb.state === 'active' || bomb.state === 'dragging';
}
