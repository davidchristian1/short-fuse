import Phaser from 'phaser';

export const INK = 0x1d1630;
export const INK_CSS = '#1d1630';
export const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_HEAVY = '"Arial Black", "Segoe UI Black", "Arial Rounded MT Bold", system-ui, sans-serif';

export function textStyle(size: number, color = '#ffffff', stroke = Math.max(3, Math.round(size / 4)), heavy = true): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: heavy ? FONT_HEAVY : FONT,
    fontSize: `${size}px`,
    color,
    stroke: INK_CSS,
    strokeThickness: stroke,
    resolution: 2,
  };
}

export const DEPTH = {
  background: 0,
  zones: 10,
  doors: 20,
  rings: 90,
  bombBase: 100,
  sorting: 900,
  dragging: 1000,
  effects: 1500,
  hud: 2000,
  banner: 2100,
} as const;
