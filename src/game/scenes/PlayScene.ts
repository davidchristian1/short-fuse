import Phaser from 'phaser';
import type { CategoryId } from '../../config/categories';
import { audio } from '../../audio/AudioManager';
import { GameSession, type SessionEvent } from '../../logic/GameSession';
import { zoneAt, type DoorId } from '../../logic/layout';
import { getSettings, updateSettings } from '../../settings';
import { submitScore } from '../../storage/persistence';
import { showGameOver, showPause, toggleFullscreen } from '../../ui/screens';
import { BombView } from '../objects/BombView';
import { DoorView } from '../objects/DoorView';
import { HudView } from '../objects/HudView';
import { ZoneView } from '../objects/ZoneView';
import { floatingText, playExplosion, reducedMotion, showBanner } from '../fx';
import { coverBackground, currentOrientation, syncGameSize } from '../scale';

interface PlayData {
  startLevel?: number;
  debug?: boolean;
}

export class PlayScene extends Phaser.Scene {
  private session!: GameSession;
  private views = new Map<number, BombView>();
  private zones = new Map<CategoryId, ZoneView>();
  private doors: DoorView[] = [];
  private hud!: HudView;
  private bg?: Phaser.GameObjects.Image;
  private unmountUi: () => void = () => undefined;
  private combo = 0;
  private comboUntil = 0;
  private overShown = false;
  private debug = false;
  private hiddenHandler = (): void => {
    if (document.hidden && this.session?.state === 'running') this.pauseRun();
  };

  constructor() {
    super('Play');
  }

  create(data: PlayData): void {
    audio.unlock();
    this.debug = !!data.debug;
    this.overShown = false;
    this.combo = 0;
    this.views.clear();
    this.session = new GameSession({
      orientation: currentOrientation(),
      startLevel: data.startLevel,
    });
    this.buildWorld();
    this.hud = new HudView(this, this.session.layout, () => this.togglePause());
    this.bindInput();
    this.session.start();
    (globalThis as unknown as { __bsp?: GameSession }).__bsp = this.session;
    if ((data.startLevel ?? 1) <= 1) {
      showBanner(this, 'DRAG EACH BOMB TO ITS MATCHING ZONE.', 'Same emblem, same bin. Fuses never pause.', 4200);
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    document.addEventListener('visibilitychange', this.hiddenHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
  }

  override update(_time: number, delta: number): void {
    if (!this.session) return;
    for (const p of this.input.manager.pointers) {
      if (p && p.active && p.isDown && this.session.draggedBombFor(p.id)) {
        this.session.moveDrag(p.id, p.worldX, p.worldY);
      }
    }
    this.session.update(delta);
    this.handleEvents(this.session.drainEvents());
    this.syncBombs();
    this.syncHovers();
    this.hud.update(
      this.session.bankedScore,
      this.session.pendingTotal,
      this.session.level,
      this.session.difficulty.stageName,
      this.session.levelElapsedMs / this.session.difficulty.levelDurationMs,
    );
  }

  private buildWorld(): void {
    this.bg?.destroy();
    this.bg = coverBackground(this, this.session.layout.orientation);
    this.rebuildDoors();
    this.rebuildZones();
  }

  private rebuildDoors(): void {
    for (const d of this.doors) d.destroy();
    this.doors = this.session.layout.doors.map((slot) => {
      const locked = slot.id >= this.session.difficulty.activeDoors;
      return new DoorView(this, slot, locked);
    });
  }

  private rebuildZones(): void {
    for (const z of this.zones.values()) z.destroy();
    this.zones.clear();
    for (const id of this.session.activeCategories) {
      const rect = this.session.layout.zones[id];
      if (!rect) continue;
      const view = new ZoneView(this, id, rect);
      view.setPending(this.session.zones[id].pending);
      this.zones.set(id, view);
    }
  }

  private bindInput(): void {
    this.input.addPointer(2);
    this.input.setTopOnly(true);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.input.on('pointercancel', this.onCancel, this);
    this.input.on('gameout', () => {
      for (const p of this.input.manager.pointers) {
        if (p) this.session.cancelDrag(p.id);
      }
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.togglePause());
    kb?.on('keydown-M', () => {
      audio.unlock();
      updateSettings({ muted: !getSettings().muted });
    });
    kb?.on('keydown-F', () => { void toggleFullscreen(); });
    kb?.on('keydown-ENTER', () => {
      if (this.session.state === 'paused') this.resumeRun();
    });

    if (this.debug) {
      kb?.on('keydown', (ev: KeyboardEvent) => {
        if (this.session.state !== 'running') return;
        const map: Record<string, CategoryId> = { '1': 'ember', '2': 'midnight', '3': 'aqua', '4': 'moss' };
        const cat = map[ev.key];
        if (cat && this.session.activeCategories.includes(cat)) {
          this.session.spawnNow({ doorId: 0, category: cat, special: null });
        }
        if (ev.key === 'l' || ev.key === 'L') this.session.setLevel(this.session.level + 1);
        if (ev.key === '[') this.session.setLevel(Math.max(1, this.session.level - 1));
        if (ev.key === ']') this.session.setLevel(this.session.level + 5);
      });
    }
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    audio.unlock();
    if (this.session.state !== 'running') return;
    if (this.hud.hitsChrome(pointer.worldX, pointer.worldY)) return;
    const bomb = this.session.pickBombAt(pointer.worldX, pointer.worldY);
    if (!bomb) return;
    if (this.session.grab(bomb.id, pointer.worldX, pointer.worldY, pointer.id)) audio.pickup();
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.session.state !== 'running') return;
    this.session.moveDrag(pointer.id, pointer.worldX, pointer.worldY);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const outcome = this.session.release(pointer.id, pointer.worldX, pointer.worldY);
    if (outcome === 'returned') audio.drop();
  }

  private onCancel(pointer: Phaser.Input.Pointer): void {
    this.session.cancelDrag(pointer.id);
  }

  private syncBombs(): void {
    const live = new Set<number>();
    const now = this.time.now;
    for (const bomb of this.session.bombs) {
      if (bomb.state === 'exploding' || bomb.state === 'sorted' || bomb.state === 'removed') {
        const existing = this.views.get(bomb.id);
        if (existing) {
          existing.destroy();
          this.views.delete(bomb.id);
        }
        continue;
      }
      live.add(bomb.id);
      let view = this.views.get(bomb.id);
      if (!view) {
        view = new BombView(this, bomb, this.session.layout.bombSize);
        this.views.set(bomb.id, view);
      }
      view.sync(bomb, now);
    }
    for (const [id, view] of this.views) {
      if (!live.has(id)) {
        view.destroy();
        this.views.delete(id);
      }
    }
  }

  private syncHovers(): void {
    const hovered = new Set<CategoryId>();
    if (this.session.state === 'running') {
      for (const bomb of this.session.bombs) {
        if (bomb.state !== 'dragging') continue;
        const z = zoneAt(this.session.layout, bomb.x, bomb.y);
        if (z) hovered.add(z);
      }
    }
    for (const [id, view] of this.zones) view.setHover(hovered.has(id));
  }

  private handleEvents(events: SessionEvent[]): void {
    const doorDumps = new Map<DoorId, number>();
    for (const e of events) {
      switch (e.type) {
        case 'spawned':
          doorDumps.set(e.bomb.doorId, (doorDumps.get(e.bomb.doorId) ?? 0) + 1);
          break;
        case 'sorted': {
          const now = this.time.now;
          this.combo = now < this.comboUntil ? this.combo + 1 : 0;
          this.comboUntil = now + 900;
          audio.sort(e.zone, this.combo);
          if (e.bonus) {
            audio.bonus();
            floatingText(this, e.bomb.x, e.bomb.y - 30, `+${e.bonus}`, '#ffe14d');
          }
          this.zones.get(e.zone)?.setPending(e.pending);
          this.animateSort(e.bomb.id, e.zone);
          break;
        }
        case 'collected':
          audio.collect();
          this.zones.get(e.zone)?.playCollect();
          this.zones.get(e.zone)?.setPending(this.session.zones[e.zone].pending);
          break;
        case 'fuseWarning':
          audio.fuseWarning();
          break;
        case 'fuseTick':
          audio.fuseTick(e.urgency);
          break;
        case 'levelUp':
          if (e.level > 1) audio.levelUp();
          if (e.unlocks.length) {
            for (const u of e.unlocks) {
              if (u.kind === 'door' || u.kind === 'volley') audio.doorOpen();
              showBanner(this, u.title, u.detail, 2800);
            }
            this.rebuildDoors();
          } else if (e.level > 1) {
            showBanner(this, `LEVEL ${e.level}`, e.difficulty.stageName, 1400);
          }
          break;
        case 'layoutChanged':
          this.buildWorld();
          this.hud.relayout(e.layout);
          for (const [id, view] of this.views) {
            const bomb = this.session.getBomb(id);
            if (bomb) view.setBombSize(e.layout.bombSize, bomb);
          }
          break;
        case 'explode':
          if (e.cause === 'wrongZone') audio.wrong();
          audio.explosion();
          playExplosion(this, e.bomb.x, e.bomb.y, 1.15);
          this.views.get(e.bomb.id)?.destroy();
          this.views.delete(e.bomb.id);
          if (e.zone) {
            const zone = this.zones.get(e.zone);
            zone?.explodeChain(e.chainCount, (i) => audio.chainPop(i));
          }
          break;
        case 'gameOver':
          this.finishRun();
          break;
      }
    }
    for (const [id, n] of doorDumps) {
      audio.spawn();
      this.doors[id]?.pulseOpen(420 + Math.min(n, 4) * 90);
    }
  }

  private animateSort(bombId: number, zone: CategoryId): void {
    const view = this.views.get(bombId);
    const z = this.session.layout.zones[zone];
    this.views.delete(bombId);
    const applyPending = () => this.zones.get(zone)?.setPending(this.session.zones[zone].pending);
    if (!view || !z) {
      applyPending();
      return;
    }
    view.setDepth(900);
    const tx = z.x + z.w / 2;
    const ty = z.y + Math.min(80, z.h * 0.35);
    this.tweens.add({
      targets: view,
      x: tx,
      y: ty,
      scale: reducedMotion() ? 0.4 : 0.2,
      duration: reducedMotion() ? 120 : 280,
      ease: 'Quad.easeIn',
      onComplete: () => {
        view.destroy();
        applyPending();
      },
    });
  }

  private finishRun(): void {
    if (this.overShown || !this.session.summary) return;
    this.overShown = true;
    const summary = this.session.summary;
    const delay = reducedMotion() ? 420 : 720 + Math.min(8, summary.lostBombs) * 70;
    this.time.delayedCall(delay, () => {
      audio.gameOver();
      const isNewBest = submitScore(summary.finalScore);
      if (isNewBest) audio.highScore();
      this.unmountUi();
      this.unmountUi = showGameOver({
        summary,
        isNewBest,
        onAgain: () => this.scene.restart({ startLevel: 1, debug: this.debug }),
        onMenu: () => this.scene.start('Menu', { debug: this.debug }),
      });
    });
  }

  private togglePause(): void {
    if (this.session.state === 'running') this.pauseRun();
    else if (this.session.state === 'paused') this.resumeRun();
  }

  private pauseRun(): void {
    if (!this.session.pause()) return;
    audio.unlock();
    this.unmountUi();
    this.unmountUi = showPause({
      onResume: () => this.resumeRun(),
      onMenu: () => this.scene.start('Menu', { debug: this.debug }),
    });
  }

  private resumeRun(): void {
    this.unmountUi();
    this.unmountUi = () => undefined;
    this.session.resume();
  }

  private onResize(): void {
    const orientation = syncGameSize(this.game);
    this.session.setOrientation(orientation);
    this.cameras.main.setViewport(0, 0, this.session.layout.width, this.session.layout.height);
  }

  private shutdownScene(): void {
    document.removeEventListener('visibilitychange', this.hiddenHandler);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.unmountUi();
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.hud.destroy();
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    for (const z of this.zones.values()) z.destroy();
    this.zones.clear();
    for (const d of this.doors) d.destroy();
    this.doors = [];
    delete (globalThis as unknown as { __bsp?: GameSession }).__bsp;
  }
}
