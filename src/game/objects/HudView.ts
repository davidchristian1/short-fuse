import Phaser from 'phaser';
import type { Layout } from '../../logic/layout';
import { audio } from '../../audio/AudioManager';
import { getSettings, onSettingsChange, updateSettings } from '../../settings';
import { DEPTH, textStyle } from '../../ui/theme';

export class HudView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly pendingText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly pauseBtn: Phaser.GameObjects.Image;
  private readonly muteBtn: Phaser.GameObjects.Image;
  private readonly progress: Phaser.GameObjects.Graphics;
  private readonly disposeSettings: () => void;
  private layout: Layout;

  constructor(
    scene: Phaser.Scene,
    layout: Layout,
    private readonly onPause: () => void,
  ) {
    this.layout = layout;
    this.root = scene.add.container(0, 0).setDepth(DEPTH.hud);
    this.bg = scene.add.graphics();
    this.progress = scene.add.graphics();
    this.scoreText = scene.add.text(16, 12, 'SCORE 0', textStyle(22, '#ffd257', 5));
    this.pendingText = scene.add.text(16, 40, 'PENDING 0', textStyle(14, '#fff8ea', 3));
    this.levelText = scene.add.text(layout.width / 2, 22, 'LEVEL 1', textStyle(20, '#fff8ea', 5)).setOrigin(0.5, 0);
    this.pauseBtn = scene.add.image(0, 0, 'icon_pause').setInteractive({ useHandCursor: true });
    this.muteBtn = scene.add.image(0, 0, getSettings().muted ? 'icon_sound_off' : 'icon_sound_on')
      .setInteractive({ useHandCursor: true });
    this.root.add([this.bg, this.progress, this.scoreText, this.pendingText, this.levelText, this.muteBtn, this.pauseBtn]);
    this.placeChrome();
    this.paintChrome();

    this.pauseBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      this.onPause();
    });
    this.muteBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      audio.unlock();
      updateSettings({ muted: !getSettings().muted });
      audio.uiSelect();
    });
    this.disposeSettings = onSettingsChange((s) => {
      this.muteBtn.setTexture(s.muted ? 'icon_sound_off' : 'icon_sound_on');
      this.muteBtn.setDisplaySize(this.layout.chromeSize, this.layout.chromeSize);
    });
  }

  relayout(layout: Layout): void {
    this.layout = layout;
    this.placeChrome();
    this.paintChrome();
  }

  update(score: number, pending: number, level: number, stageName: string, levelFrac: number): void {
    this.scoreText.setText(`SCORE ${score}`);
    this.pendingText.setText(`PENDING ${pending}`);
    this.levelText.setText(`LEVEL ${level}  ·  ${stageName.toUpperCase()}`);
    this.progress.clear();
    const y = this.layout.hud.h - 8;
    this.progress.fillStyle(0x1d1630, 0.8);
    this.progress.fillRect(12, y, this.layout.width - 24, 6);
    this.progress.fillStyle(0xffd257, 1);
    this.progress.fillRect(12, y, (this.layout.width - 24) * Math.max(0, Math.min(1, levelFrac)), 6);
  }

  hitsChrome(x: number, y: number): boolean {
    const r = this.layout.chromeSize * 0.62;
    return Phaser.Math.Distance.Between(x, y, this.pauseBtn.x, this.pauseBtn.y) < r
      || Phaser.Math.Distance.Between(x, y, this.muteBtn.x, this.muteBtn.y) < r;
  }

  destroy(): void {
    this.disposeSettings();
    this.root.destroy(true);
  }

  private placeChrome(): void {
    const { width, hud, chromeSize, orientation } = this.layout;
    const cy = hud.h / 2;
    const pad = orientation === 'portrait' ? 16 : 12;
    this.pauseBtn.setDisplaySize(chromeSize, chromeSize).setPosition(width - pad - chromeSize / 2, cy);
    this.muteBtn.setDisplaySize(chromeSize, chromeSize).setPosition(width - pad - chromeSize * 1.55 - 8, cy);
    this.levelText.setX(width / 2);
    const titleSize = orientation === 'portrait' ? 18 : 20;
    this.levelText.setFontSize(titleSize);
    this.scoreText.setY(orientation === 'portrait' ? 16 : 12);
    this.pendingText.setY(orientation === 'portrait' ? 44 : 40);
  }

  private paintChrome(): void {
    const { w, h } = this.layout.hud;
    this.bg.clear();
    this.bg.fillStyle(0x1d1630, 0.55);
    this.bg.fillRect(0, 0, w, h);
    this.bg.lineStyle(3, 0xffd257, 0.35);
    this.bg.lineBetween(8, h - 1, w - 8, h - 1);
  }
}
