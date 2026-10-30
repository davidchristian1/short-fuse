import Phaser from 'phaser';
import { LOGICAL_SIZE, orientationFor, type Orientation } from '../logic/layout';
import { DEPTH } from '../ui/theme';

export function currentOrientation(): Orientation {
  return orientationFor(window.innerWidth, window.innerHeight);
}

/** Keeps the logical playfield matching landscape vs portrait. */
export function syncGameSize(game: Phaser.Game): Orientation {
  const orientation = currentOrientation();
  const size = LOGICAL_SIZE[orientation];
  if (game.scale.width !== size.width || game.scale.height !== size.height) {
    game.scale.setGameSize(size.width, size.height);
  }
  return orientation;
}

export function coverBackground(scene: Phaser.Scene, orientation: Orientation): Phaser.GameObjects.Image {
  const key = orientation === 'portrait' ? 'bg_portrait' : 'bg_landscape';
  const { width, height } = scene.scale;
  const img = scene.add.image(width / 2, height / 2, key).setDepth(DEPTH.background);
  const scale = Math.max(width / img.width, height / img.height);
  img.setScale(scale);
  return img;
}
