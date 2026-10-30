import { CATEGORY_ORDER, type CategoryId } from '../config/categories';
import type { SpecialType } from '../logic/difficulty';
import bombMeta from './bombMeta.json';

export const BOMB_FRAMES = ['walk0', 'walk1', 'blink', 'drag', 'panic0', 'panic1', 'happy'] as const;
export type BombFrame = (typeof BOMB_FRAMES)[number];

export interface SvgAsset { key: string; file: string; width: number; height: number }

/** Bomb textures are rasterized at 2x their on-screen size for crisp scaling. */
export const BOMB_TEXTURE_SIZE = 176;
export const MINI_TEXTURE_SIZE = 64;

export const bombKey = (cat: CategoryId, frame: BombFrame) => `bomb_${cat}_${frame}`;
export const miniKey = (cat: CategoryId) => `mini_${cat}`;
export const badgeKey = (s: SpecialType) => `badge_${s}`;

export const FUSE_TIPS = bombMeta.fuseTips as Record<CategoryId, { tipX: number; tipY: number; size: number }>;

function svgList(): SvgAsset[] {
  const list: SvgAsset[] = [];
  const add = (key: string, w: number, h = w, file = key) => list.push({ key, file: `assets/svg/${file}.svg`, width: w, height: h });
  for (const cat of CATEGORY_ORDER) {
    for (const frame of BOMB_FRAMES) add(bombKey(cat, frame), BOMB_TEXTURE_SIZE);
    add(miniKey(cat), MINI_TEXTURE_SIZE, MINI_TEXTURE_SIZE, bombKey(cat, 'happy'));
    add(`emblem_${cat}`, 128);
    add(`zone_${cat}`, 192);
  }
  for (let i = 0; i < 4; i++) add(`spark_${i}`, 64);
  for (let i = 0; i < 6; i++) add(`explosion_${i}`, 256);
  for (const k of ['smoke_puff']) add(k, 64);
  for (const k of ['debris_gear', 'debris_bolt', 'debris_star']) add(k, 32);
  add('particle_glow', 32);
  add('sparkle', 48);
  add('confetti', 16, 24);
  for (const k of ['door_a_closed', 'door_a_open', 'door_b_closed', 'door_b_open', 'door_b_locked']) add(k, 240, 216);
  for (const s of ['shortFuse', 'speedy', 'heavy', 'bonus'] as SpecialType[]) add(badgeKey(s), 64, 64, `badge_${s.toLowerCase()}`);
  for (const k of ['icon_pause', 'icon_play', 'icon_sound_on', 'icon_sound_off', 'icon_fullscreen', 'icon_home', 'icon_restart', 'icon_settings']) add(k, 64);
  for (const k of ['button_round', 'button_round_hover', 'button_round_pressed']) add(k, 96);
  add('collect_stamp', 160);
  return list;
}

export const SVG_ASSETS = svgList();

export const IMAGE_ASSETS = [
  { key: 'bg_landscape', file: 'assets/bg/factory_floor_landscape.jpg' },
  { key: 'bg_portrait', file: 'assets/bg/factory_floor_portrait.jpg' },
];
