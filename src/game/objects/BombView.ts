import Phaser from 'phaser';
import { RULES } from '../../config/gameConfig';
import { FUSE_TIPS, badgeKey, bombKey, type BombFrame } from '../../assets/manifest';
import { fuseFraction, type Bomb } from '../../logic/bomb';
import { DEPTH } from '../../ui/theme';
import { reducedMotion } from '../fx';

export class BombView extends Phaser.GameObjects.Container {
  readonly bombId: number;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly spark: Phaser.GameObjects.Sprite;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly badge: Phaser.GameObjects.Image | null;
  private frameName: BombFrame = 'walk0';
  private blinkUntil = 0;
  private nextBlink = 0;
  private size: number;

  constructor(scene: Phaser.Scene, bomb: Bomb, size: number) {
    super(scene, bomb.x, bomb.y);
    this.bombId = bomb.id;
    this.size = size;
    this.sprite = scene.add.image(0, 0, bombKey(bomb.category, 'walk0'));
    this.sprite.setDisplaySize(size, size);
    this.spark = scene.add.sprite(0, 0, 'spark_0').setVisible(false);
    this.spark.play('spark');
    this.ring = scene.add.graphics();
    this.add([this.ring, this.sprite, this.spark]);
    if (bomb.special) {
      this.badge = scene.add.image(size * 0.34, -size * 0.34, badgeKey(bomb.special)).setDisplaySize(28, 28);
      this.add(this.badge);
    } else {
      this.badge = null;
    }
    this.setSize(size, size);
    this.setDepth(DEPTH.bombBase + bomb.id);
    scene.add.existing(this);
    this.placeSpark(bomb);
    this.sync(bomb, 0);
  }

  setBombSize(size: number, bomb: Bomb): void {
    this.size = size;
    this.sprite.setDisplaySize(size, size);
    this.setSize(size, size);
    this.placeSpark(bomb);
    if (this.badge) this.badge.setPosition(size * 0.34, -size * 0.34);
  }

  private placeSpark(bomb: Bomb): void {
    const tip = FUSE_TIPS[bomb.category];
    const scale = this.size / tip.size;
    this.spark.setPosition((tip.tipX - tip.size / 2) * scale, (tip.tipY - tip.size / 2) * scale);
    this.spark.setDisplaySize(22, 22);
  }

  sync(bomb: Bomb, time: number): void {
    this.setPosition(bomb.x, bomb.y);
    if (bomb.state === 'dragging') this.setDepth(DEPTH.dragging);
    else if (bomb.state === 'sorted') this.setDepth(DEPTH.sorting);
    else this.setDepth(DEPTH.bombBase + bomb.id);

    const panic = fuseFraction(bomb) <= RULES.fuseWarningFraction && bomb.fuseRunning;
    const moving = bomb.state === 'active' && Math.hypot(bomb.vx, bomb.vy) > 6;
    if (bomb.state === 'active' && !moving && !panic && time >= this.nextBlink) {
      this.blinkUntil = time + 120;
      this.nextBlink = time + 1800 + (bomb.id % 7) * 280;
    }

    let frame: BombFrame = 'walk0';
    if (bomb.state === 'dragging') frame = 'drag';
    else if (bomb.state === 'sorted') frame = 'happy';
    else if (panic) frame = Math.floor(time / (90 + fuseFraction(bomb) * 80)) % 2 === 0 ? 'panic0' : 'panic1';
    else if (time < this.blinkUntil) frame = 'blink';
    else if (moving) frame = Math.floor(time / 140) % 2 === 0 ? 'walk0' : 'walk1';

    if (frame !== this.frameName) {
      this.frameName = frame;
      this.sprite.setTexture(bombKey(bomb.category, frame));
      this.sprite.setDisplaySize(this.size, this.size);
    }

    const dragging = bomb.state === 'dragging';
    const baseScale = bomb.special === 'heavy' ? 1.08 : bomb.special === 'speedy' ? 0.94 : 1;
    this.setScale(baseScale * (dragging ? 1.12 : 1));
    if (!reducedMotion() && bomb.state === 'active' && moving) {
      this.sprite.y = Math.sin(time / 140) * 2;
    } else {
      this.sprite.y = dragging ? -6 : 0;
    }

    const fuseOn = bomb.fuseRunning && (bomb.state === 'active' || bomb.state === 'dragging');
    this.spark.setVisible(fuseOn);
    if (fuseOn) {
      const urgency = 1 - fuseFraction(bomb);
      this.spark.setScale(0.7 + urgency * 0.55);
      this.spark.anims.timeScale = 1 + urgency * 1.8;
    }

    this.ring.clear();
    if (fuseOn) {
      const frac = fuseFraction(bomb);
      const color = frac > 0.45 ? 0x4fd36a : frac > 0.22 ? 0xffd257 : 0xff4a4a;
      this.ring.lineStyle(4, 0x1d1630, 0.9);
      this.ring.strokeCircle(0, 4, this.size * 0.46);
      this.ring.lineStyle(3.5, color, 0.95);
      this.ring.beginPath();
      this.ring.arc(0, 4, this.size * 0.46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      this.ring.strokePath();
    }
  }
}
