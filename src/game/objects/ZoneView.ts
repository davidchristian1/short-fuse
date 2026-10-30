import Phaser from 'phaser';
import { CATEGORIES, type CategoryId } from '../../config/categories';
import { RULES } from '../../config/gameConfig';
import { miniKey } from '../../assets/manifest';
import type { Rect } from '../../logic/layout';
import { DEPTH, textStyle } from '../../ui/theme';
import { floatingText, playExplosion, reducedMotion, sparkles } from '../fx';

const MINI = 28;
const COLS = 8;

export class ZoneView {
  readonly category: CategoryId;
  private readonly root: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.NineSlice;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly countText: Phaser.GameObjects.Text;
  private readonly emblem: Phaser.GameObjects.Image;
  private readonly name: Phaser.GameObjects.Text;
  private readonly minis: Phaser.GameObjects.Container;
  private rect: Rect;
  private pending = 0;
  private hovered = false;

  constructor(private readonly scene: Phaser.Scene, category: CategoryId, rect: Rect) {
    this.category = category;
    this.rect = rect;
    this.root = scene.add.container(rect.x, rect.y).setDepth(DEPTH.zones);
    this.frame = scene.add.nineslice(0, 0, `zone_${category}`, undefined, rect.w, rect.h, 40, 40, 40, 40).setOrigin(0);
    this.highlight = scene.add.graphics();
    this.fill = scene.add.graphics();
    const cat = CATEGORIES[category];
    this.emblem = scene.add.image(36, 28, `emblem_${category}`).setDisplaySize(36, 36);
    this.name = scene.add.text(58, 16, cat.name.toUpperCase(), textStyle(18, '#fff8ea', 4)).setOrigin(0, 0);
    this.countText = scene.add.text(rect.w - 12, 18, '0 / 40', textStyle(16, '#ffe14d', 4)).setOrigin(1, 0);
    this.minis = scene.add.container(16, 52);
    this.root.add([this.frame, this.highlight, this.fill, this.emblem, this.name, this.countText, this.minis]);
    this.placeHeader();
    this.redrawProgress(0);
  }

  layout(rect: Rect): void {
    this.rect = rect;
    this.root.setPosition(rect.x, rect.y);
    this.frame.setSize(rect.w, rect.h);
    this.placeHeader();
    this.rebuildMinis();
    this.redrawProgress(this.pending);
    this.setHover(this.hovered);
  }

  setPending(count: number): void {
    this.pending = count;
    this.countText.setText(`${count} / ${RULES.collectionThreshold}`);
    this.rebuildMinis();
    this.redrawProgress(count);
  }

  addOne(): void {
    this.setPending(this.pending + 1);
  }

  setHover(on: boolean): void {
    this.hovered = on;
    this.highlight.clear();
    if (!on) return;
    this.highlight.lineStyle(6, 0xfff4b0, 0.95);
    this.highlight.strokeRoundedRect(4, 4, this.rect.w - 8, this.rect.h - 8, 22);
  }

  playCollect(): void {
    const { x, y, w, h } = this.rect;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const stamp = this.scene.add.image(cx, cy, 'collect_stamp').setDepth(DEPTH.effects).setScale(0.2);
    this.scene.tweens.add({
      targets: stamp,
      scale: reducedMotion() ? 0.7 : 0.95,
      duration: reducedMotion() ? 120 : 280,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 180,
      onComplete: () => stamp.destroy(),
    });
    sparkles(this.scene, cx, cy, 10);
    floatingText(this.scene, cx, cy - 20, `+${RULES.collectionThreshold}`, '#8dff9e');
  }

  /** Chain-reaction pops for stored bombs. Uses the count captured at detonation. */
  explodeChain(count: number, onPop: (index: number) => void): void {
    const pops = Math.min(count, this.minis.length);
    const delay = reducedMotion() ? 30 : 70;
    for (let i = 0; i < Math.max(pops, 1); i++) {
      this.scene.time.delayedCall(i * delay, () => {
        const child = this.minis.getAll()[this.minis.length - 1] as Phaser.GameObjects.Image | undefined;
        if (child) {
          playExplosion(this.scene, this.rect.x + this.minis.x + child.x, this.rect.y + this.minis.y + child.y, 0.45);
          child.destroy();
        } else {
          playExplosion(this.scene, this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h / 2, 0.6);
        }
        onPop(i);
      });
    }
    this.pending = 0;
    this.countText.setText(`0 / ${RULES.collectionThreshold}`);
    this.redrawProgress(0);
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private placeHeader(): void {
    const compact = this.rect.h < 220;
    const emblem = compact ? 30 : 36;
    this.emblem.setPosition(compact ? 26 : 36, compact ? 22 : 28).setDisplaySize(emblem, emblem);
    this.name.setPosition(compact ? 48 : 58, compact ? 12 : 16).setFontSize(compact ? 15 : 18);
    this.countText.setPosition(this.rect.w - 10, compact ? 14 : 18).setFontSize(compact ? 14 : 16);
    this.minis.setPosition(14, compact ? 44 : 52);
  }

  private rebuildMinis(): void {
    this.minis.removeAll(true);
    const innerW = this.rect.w - 32;
    const innerH = this.rect.h - 70;
    const cols = Math.max(4, Math.min(COLS, Math.floor(innerW / (MINI + 2))));
    const rows = Math.max(1, Math.floor(innerH / (MINI + 2)));
    const shown = Math.min(this.pending, cols * rows);
    for (let i = 0; i < shown; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const img = this.scene.add.image(col * (MINI + 2) + MINI / 2, row * (MINI + 2) + MINI / 2, miniKey(this.category));
      img.setDisplaySize(MINI, MINI);
      this.minis.add(img);
    }
  }

  private redrawProgress(count: number): void {
    this.fill.clear();
    const frac = Math.max(0, Math.min(1, count / RULES.collectionThreshold));
    const x = 18, y = this.rect.h - 22, w = this.rect.w - 36, h = 10;
    this.fill.fillStyle(0x1d1630, 0.85);
    this.fill.fillRoundedRect(x, y, w, h, 5);
    if (frac > 0) {
      this.fill.fillStyle(CATEGORIES[this.category].color, 1);
      this.fill.fillRoundedRect(x + 1, y + 1, Math.max(6, (w - 2) * frac), h - 2, 4);
    }
  }
}
