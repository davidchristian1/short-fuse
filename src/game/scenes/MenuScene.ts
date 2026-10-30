import Phaser from 'phaser';
import { bombKey, type BombFrame } from '../../assets/manifest';
import { CATEGORY_ORDER } from '../../config/categories';
import { audio } from '../../audio/AudioManager';
import { LOGICAL_SIZE } from '../../logic/layout';
import { coverBackground, currentOrientation, syncGameSize } from '../scale';
import { showMenu } from '../../ui/screens';
import { reducedMotion } from '../fx';

interface MenuData {
  startLevel?: number;
  debug?: boolean;
}

export class MenuScene extends Phaser.Scene {
  private unmount: () => void = () => undefined;
  private bg?: Phaser.GameObjects.Image;
  private toys: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Menu');
  }

  create(data: MenuData): void {
    audio.unlock();
    this.drawScene();
    this.unmount = showMenu({
      onPlay: () => {
        audio.unlock();
        audio.gameStart();
        this.scene.start('Play', data);
      },
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.input.keyboard?.on('keydown-ENTER', this.startPlay, this);
    this.input.keyboard?.on('keydown-SPACE', this.startPlay, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
  }

  private startPlay(): void {
    const play = document.getElementById('play-btn') as HTMLButtonElement | null;
    play?.click();
  }

  private onResize(): void {
    syncGameSize(this.game);
    this.drawScene();
  }

  private drawScene(): void {
    for (const t of this.toys) {
      this.tweens.killTweensOf(t);
      t.destroy();
    }
    this.toys = [];
    this.bg?.destroy();
    const orientation = currentOrientation();
    const size = LOGICAL_SIZE[orientation];
    this.cameras.main.setViewport(0, 0, size.width, size.height);
    this.bg = coverBackground(this, orientation);
    this.spawnToys(size.width, size.height);
  }

  private spawnToys(w: number, h: number): void {
    if (reducedMotion()) return;
    const frames: BombFrame[] = ['walk0', 'walk1'];
    CATEGORY_ORDER.forEach((cat, i) => {
      const img = this.add.image(w * (0.2 + i * 0.2), h * 0.72, bombKey(cat, 'walk0')).setScale(0.72).setDepth(5);
      this.toys.push(img);
      this.tweens.add({
        targets: img,
        x: img.x + (i % 2 === 0 ? 40 : -36),
        y: img.y - 12,
        duration: 1600 + i * 220,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          img.setTexture(bombKey(cat, frames[Math.floor(this.time.now / 180) % 2]));
        },
      });
    });
  }

  private shutdownScene(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.unmount();
    this.tweens.killAll();
  }
}
