import Phaser from 'phaser';
import { IMAGE_ASSETS, SVG_ASSETS } from '../../assets/manifest';
import { GAME_CONFIG } from '../../config/gameConfig';
import { assetUrl } from '../../ui/dom';
import { parseBootQuery } from '../bootQuery';
import { syncGameSize } from '../scale';
import { showBoot } from '../../ui/screens';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    document.title = GAME_CONFIG.title;
    syncGameSize(this.game);
    const boot = showBoot();
    this.load.on('progress', (p: number) => boot.setProgress(p, 'Loading factory art…'));

    this.load.setPath(assetUrl(''));
    for (const a of SVG_ASSETS) {
      this.load.svg(a.key, a.file, { width: a.width, height: a.height });
    }
    for (const a of IMAGE_ASSETS) {
      this.load.image(a.key, a.file);
    }

    this.load.once('complete', () => boot.close());
    this.load.once('loaderror', (file: Phaser.Loader.File) => {
      boot.setProgress(1, `Missing asset: ${file.key}`);
    });
  }

  create(): void {
    this.anims.create({
      key: 'spark',
      frames: [0, 1, 2, 3].map((i) => ({ key: `spark_${i}` })),
      frameRate: 14,
      repeat: -1,
    });
    this.anims.create({
      key: 'explode',
      frames: [0, 1, 2, 3, 4, 5].map((i) => ({ key: `explosion_${i}` })),
      frameRate: 16,
      hideOnComplete: true,
    });

    const q = parseBootQuery();
    const data = { startLevel: q.startLevel, debug: q.debug };
    const autostart = new URLSearchParams(location.search).has('play');
    this.scene.start(autostart ? 'Play' : 'Menu', data);
  }
}
