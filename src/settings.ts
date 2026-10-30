import { audio } from './audio/AudioManager';
import { loadSettings, saveSettings, type Settings } from './storage/persistence';

let current: Settings = loadSettings();
const listeners = new Set<(s: Settings) => void>();

function apply(): void {
  audio.configure(current.volume, current.muted);
  document.documentElement.classList.toggle('reduced-motion', current.reducedMotion);
}
apply();

export function getSettings(): Readonly<Settings> {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  saveSettings(current);
  apply();
  for (const fn of listeners) fn(current);
}

export function onSettingsChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
