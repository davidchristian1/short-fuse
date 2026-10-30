import { audio } from '../audio/AudioManager';
import { getSettings, onSettingsChange, updateSettings } from '../settings';

type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export function button(label: string, onClick: () => void, opts: { variant?: string; icon?: string; id?: string } = {}): HTMLButtonElement {
  const b = el('button', { type: 'button', class: `btn ${opts.variant ?? ''}`.trim(), id: opts.id }, [
    opts.icon ? el('img', { src: assetUrl(`assets/svg/${opts.icon}.svg`), alt: '' }) : null,
    label,
  ]);
  b.addEventListener('click', () => {
    audio.unlock();
    audio.uiSelect();
    onClick();
  });
  return b;
}

/** Mounts a panel into the UI layer with arrow-key focus cycling. Returns an unmount function. */
export function mountPanel(panel: HTMLElement, focus?: HTMLElement): () => void {
  const root = document.getElementById('ui-root');
  if (!root) return () => undefined;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...panel.querySelectorAll<HTMLElement>('button, input')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i === -1 || (document.activeElement as HTMLElement)?.getAttribute('type') === 'range') return;
    e.preventDefault();
    const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
    next.focus();
  };
  panel.addEventListener('keydown', onKey);
  root.append(panel);
  (focus ?? panel.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  return () => {
    panel.removeEventListener('keydown', onKey);
    panel.remove();
  };
}

/** Sound toggle, master volume, reduced motion, and fullscreen. */
export function settingsControls(toggleFullscreen?: () => void): { node: HTMLElement; dispose: () => void } {
  const s = getSettings();
  const sound = button(s.muted ? 'Sound off' : 'Sound on', () => updateSettings({ muted: !getSettings().muted }), {
    variant: 'small blue', icon: s.muted ? 'icon_sound_off' : 'icon_sound_on',
  });
  sound.setAttribute('aria-pressed', String(!s.muted));

  const volume = el('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(s.volume * 100), 'aria-label': 'Master volume' });
  volume.addEventListener('input', () => updateSettings({ volume: Number(volume.value) / 100 }));
  volume.addEventListener('change', () => { audio.unlock(); audio.uiSelect(); });

  const motion = el('input', { type: 'checkbox', checked: s.reducedMotion, 'aria-label': 'Reduce motion' });
  motion.addEventListener('change', () => updateSettings({ reducedMotion: motion.checked }));

  const fsSupported = !!document.fullscreenEnabled && !!toggleFullscreen;
  const node = el('div', { class: 'settings' }, [
    sound,
    el('label', {}, ['Volume', volume]),
    el('label', {}, [motion, 'Reduce motion']),
    fsSupported ? button('Fullscreen', () => toggleFullscreen!(), { variant: 'small ghost', icon: 'icon_fullscreen' }) : null,
  ]);

  const dispose = onSettingsChange((next) => {
    sound.lastChild!.textContent = next.muted ? 'Sound off' : 'Sound on';
    (sound.firstChild as HTMLImageElement).src = assetUrl(`assets/svg/${next.muted ? 'icon_sound_off' : 'icon_sound_on'}.svg`);
    sound.setAttribute('aria-pressed', String(!next.muted));
    volume.value = String(Math.round(next.volume * 100));
    motion.checked = next.reducedMotion;
  });
  return { node, dispose };
}
