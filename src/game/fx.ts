import Phaser from 'phaser';
import { getSettings } from '../settings';
import { DEPTH, FONT_HEAVY, INK_CSS } from '../ui/theme';

const DEBRIS = ['debris_gear', 'debris_bolt', 'debris_star', 'smoke_puff'] as const;

export function reducedMotion(): boolean {
  return getSettings().reducedMotion;
}

export function playExplosion(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const boom = scene.add.sprite(x, y, 'explosion_0').setDepth(DEPTH.effects).setScale(0.55 * scale);
  boom.play('explode');
  boom.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => boom.destroy());
  const n = reducedMotion() ? 3 : 8;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 40 + Math.random() * 70 * scale;
    const img = scene.add.image(x, y, DEBRIS[i % DEBRIS.length]).setDepth(DEPTH.effects + 1).setScale(0.9 + Math.random() * 0.4);
    scene.tweens.add({
      targets: img,
      x: x + Math.cos(a) * dist,
      y: y + Math.sin(a) * dist - 20,
      angle: (Math.random() * 2 - 1) * 220,
      alpha: 0,
      duration: reducedMotion() ? 280 : 520 + Math.random() * 180,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
  }
}

export function floatingText(scene: Phaser.Scene, x: number, y: number, message: string, color = '#ffe14d'): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, message, {
    fontFamily: FONT_HEAVY,
    fontSize: '28px',
    color,
    stroke: INK_CSS,
    strokeThickness: 6,
    resolution: 2,
  }).setOrigin(0.5).setDepth(DEPTH.banner);
  scene.tweens.add({
    targets: text,
    y: y - 48,
    alpha: 0,
    duration: reducedMotion() ? 400 : 900,
    ease: 'Quad.easeOut',
    onComplete: () => text.destroy(),
  });
  return text;
}

export function sparkles(scene: Phaser.Scene, x: number, y: number, count = 6): void {
  const n = reducedMotion() ? Math.min(3, count) : count;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const img = scene.add.image(x, y, i % 2 === 0 ? 'sparkle' : 'confetti').setDepth(DEPTH.effects).setScale(0.7);
    if (img.texture.key === 'confetti') img.setTint([0xff6a4d, 0xffd257, 0x38cfe6, 0x69c84a][i % 4]);
    scene.tweens.add({
      targets: img,
      x: x + Math.cos(a) * 36,
      y: y + Math.sin(a) * 28 - 16,
      alpha: 0,
      angle: 90,
      duration: reducedMotion() ? 260 : 480,
      onComplete: () => img.destroy(),
    });
  }
}

export function showBanner(scene: Phaser.Scene, title: string, detail?: string, ms = 2200): void {
  const { width, height } = scene.scale;
  const portrait = height > width;
  const bannerW = Math.min(560, width - 36);
  const wrap = scene.add.container(width / 2, portrait ? 128 : 110).setDepth(DEPTH.banner);
  const g = scene.add.graphics();
  g.fillStyle(0x1d1630, 0.82);
  g.fillRoundedRect(-bannerW / 2, -36, bannerW, detail ? 84 : 64, 18);
  g.lineStyle(4, 0xffd257, 1);
  g.strokeRoundedRect(-bannerW / 2, -36, bannerW, detail ? 84 : 64, 18);
  const t = scene.add.text(0, detail ? -10 : 0, title, {
    fontFamily: FONT_HEAVY,
    fontSize: '26px',
    color: '#ffd257',
    stroke: INK_CSS,
    strokeThickness: 6,
    align: 'center',
    resolution: 2,
  }).setOrigin(0.5);
  wrap.add([g, t]);
  if (detail) {
    wrap.add(scene.add.text(0, 22, detail, {
      fontFamily: FONT_HEAVY,
      fontSize: '16px',
      color: '#fff8ea',
      stroke: INK_CSS,
      strokeThickness: 4,
      align: 'center',
      resolution: 2,
    }).setOrigin(0.5));
  }
  wrap.setScale(reducedMotion() ? 1 : 0.86);
  scene.tweens.add({
    targets: wrap,
    scale: 1,
    duration: reducedMotion() ? 80 : 220,
    ease: 'Back.easeOut',
  });
  scene.time.delayedCall(ms, () => {
    scene.tweens.add({
      targets: wrap,
      alpha: 0,
      y: 90,
      duration: reducedMotion() ? 120 : 260,
      onComplete: () => wrap.destroy(),
    });
  });
}
