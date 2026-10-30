import Phaser from 'phaser';
import { LOGICAL_SIZE } from '../logic/layout';
import { currentOrientation } from './scale';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayScene } from './scenes/PlayScene';

export function createGame(): Phaser.Game {
  const parent = document.getElementById('game');
  if (!parent) throw new Error('Missing #game mount');
  const size = LOGICAL_SIZE[currentOrientation()];
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: size.width,
    height: size.height,
    backgroundColor: '#1a1430',
    banner: false,
    autoFocus: true,
    disableContextMenu: true,
    audio: { noAudio: true },
    input: {
      activePointers: 3,
      windowEvents: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: size.width,
      height: size.height,
      expandParent: false,
      fullscreenTarget: parent,
    },
    render: {
      antialias: true,
      roundPixels: true,
      powerPreference: 'high-performance',
    },
    scene: [BootScene, MenuScene, PlayScene],
  });
  const refresh = (): void => {
    if (!game.isBooted) return;
    game.scale.refresh();
  };
  window.addEventListener('orientationchange', refresh);
  window.visualViewport?.addEventListener('resize', refresh);
  return game;
}
