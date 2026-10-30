import { DEFAULT_SETTINGS, GAME_CONFIG } from '../config/gameConfig';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Settings {
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
}

const BEST_KEY = `${GAME_CONFIG.storagePrefix}:best`;
const SETTINGS_KEY = `${GAME_CONFIG.storagePrefix}:settings`;

/** localStorage if usable (it can throw in private modes or sandboxed iframes), else null. */
export function browserStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = `${GAME_CONFIG.storagePrefix}:probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function loadBestScore(storage: StorageLike | null = browserStorage()): number {
  try {
    const raw = storage?.getItem(BEST_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Stores the score if it beats the saved best. Returns true for a new best. */
export function submitScore(score: number, storage: StorageLike | null = browserStorage()): boolean {
  if (!Number.isFinite(score) || score <= 0) return false;
  const best = loadBestScore(storage);
  if (score <= best) return false;
  try {
    storage?.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    // Unavailable storage: the new best still counts for this session's UI.
  }
  return true;
}

function systemPrefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
  const defaults: Settings = { ...DEFAULT_SETTINGS, reducedMotion: systemPrefersReducedMotion() };
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    return {
      volume: typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
        ? Math.max(0, Math.min(1, parsed.volume)) : defaults.volume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : defaults.muted,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaults.reducedMotion,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings simply won't persist.
  }
}
