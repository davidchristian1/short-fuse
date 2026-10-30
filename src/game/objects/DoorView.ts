import Phaser from 'phaser';
import type { DoorId, DoorSlot } from '../../logic/layout';
import { DEPTH } from '../../ui/theme';

export class DoorView {
  readonly id: DoorId;
  private readonly image: Phaser.GameObjects.Image;
  private slot: DoorSlot;
  private open = false;
  private locked = false;
  private closeTimer?: Phaser.Time.TimerEvent;

  constructor(private readonly scene: Phaser.Scene, slot: DoorSlot, locked: boolean) {
    this.id = slot.id;
    this.slot = slot;
    this.locked = locked;
    this.image = scene.add.image(slot.x, slot.y, this.texture()).setDepth(DEPTH.doors);
    this.image.setDisplaySize(slot.width, slot.height);
  }

  layout(slot: DoorSlot): void {
    this.slot = slot;
    this.image.setPosition(slot.x, slot.y);
    this.image.setDisplaySize(slot.width, slot.height);
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    if (locked) {
      this.open = false;
      this.image.setTexture(this.texture());
      this.image.setDisplaySize(this.slot.width, this.slot.height);
    }
  }

  pulseOpen(holdMs = 420): void {
    if (this.locked) return;
    this.open = true;
    this.image.setTexture(this.texture());
    this.image.setDisplaySize(this.slot.width, this.slot.height);
    this.closeTimer?.remove(false);
    this.closeTimer = this.scene.time.delayedCall(holdMs, () => {
      this.open = false;
      this.image.setTexture(this.texture());
      this.image.setDisplaySize(this.slot.width, this.slot.height);
    });
  }

  destroy(): void {
    this.closeTimer?.remove(false);
    this.image.destroy();
  }

  private texture(): string {
    if (this.id === 0) return this.open ? 'door_a_open' : 'door_a_closed';
    if (this.locked) return 'door_b_locked';
    return this.open ? 'door_b_open' : 'door_b_closed';
  }
}
