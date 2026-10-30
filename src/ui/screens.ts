import { CATEGORIES, CATEGORY_ORDER } from '../config/categories';
import { GAME_CONFIG } from '../config/gameConfig';
import type { RunSummary } from '../logic/scoring';
import { loadBestScore } from '../storage/persistence';
import { assetUrl, button, el, mountPanel, settingsControls } from './dom';

const TITLE_WORDS = GAME_CONFIG.title.split(' ');
const TITLE_LAST = TITLE_WORDS.pop() ?? GAME_CONFIG.title;
const TITLE_FIRST = TITLE_WORDS.join(' ') || GAME_CONFIG.title;

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // Fullscreen can be denied by the browser; the rest of the game still works.
  }
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function causeCopy(summary: RunSummary): { heading: string; detail: string } {
  const bomb = CATEGORIES[summary.bombCategory].name;
  if (summary.cause === 'wrongZone') {
    const zone = summary.detonatedZone ? CATEGORIES[summary.detonatedZone].name : 'the wrong zone';
    return {
      heading: 'WRONG BIN!',
      detail: `That ${bomb} bomb does not belong in ${zone}. The whole bin went boom.`,
    };
  }
  return {
    heading: 'FUSE RAN OUT!',
    detail: `A ${bomb} bomb sat unsorted until its fuse expired.`,
  };
}

export function showBoot(): { setProgress: (p: number, label?: string) => void; close: () => void } {
  const bar = el('span');
  const status = el('p', { class: 'boot-status', text: 'Warming up the factory…' });
  const panel = el('div', { class: 'panel boot-panel' }, [
    el('h2', { class: 'heading', text: GAME_CONFIG.title }),
    el('div', { class: 'boot-bar' }, [bar]),
    status,
  ]);
  const overlay = el('div', { class: 'overlay boot' }, [panel]);
  const close = mountPanel(overlay);
  return {
    setProgress(p: number, label?: string) {
      bar.style.width = `${Math.max(0, Math.min(100, p * 100))}%`;
      if (label) status.textContent = label;
    },
    close,
  };
}

export function showMenu(opts: { onPlay: () => void }): () => void {
  const title = el('h1', { class: 'title' }, [
    el('span', { class: 'line1', text: TITLE_FIRST }),
    el('span', { class: 'line2', text: TITLE_LAST }),
  ]);
  const emblems = el('div', { class: 'emblems' }, CATEGORY_ORDER.map((id, i) =>
    el('div', { class: `emblem-chip${i >= 2 ? ' locked' : ''}` }, [
      el('img', { src: assetUrl(`assets/svg/emblem_${id}.svg`), alt: CATEGORIES[id].name }),
      CATEGORIES[id].name,
    ]),
  ));
  const settings = settingsControls(() => { void toggleFullscreen(); });
  const play = button('Play', opts.onPlay, { variant: 'big', icon: 'icon_play', id: 'play-btn' });
  const panel = el('div', { class: 'panel menu', role: 'dialog', 'aria-label': 'Main menu' }, [
    el('div', { class: 'title-wrap', style: `background-image:url("${assetUrl('assets/svg/title_burst.svg')}")` }, [title]),
    el('p', { class: 'tagline', text: GAME_CONFIG.tagline }),
    emblems,
    el('p', { class: 'best' }, ['Best score ', el('b', { text: String(loadBestScore()) })]),
    el('div', { class: 'btn-col' }, [play]),
    el('div', { class: 'howto' }, [
      el('strong', { text: 'DRAG EACH BOMB TO ITS MATCHING ZONE.' }),
      el('ul', {}, [
        el('li', { text: 'Grab a bomb and drop it in the bin with the same emblem.' }),
        el('li', { text: 'Fuses keep burning while you drag — sort the urgent ones first.' }),
        el('li', { text: 'Fill a bin to 40 to ship it and bank the points.' }),
        el('li', { text: 'One wrong bin or a burnt fuse ends the run.' }),
      ]),
    ]),
    settings.node,
    el('p', { class: 'kbd-hint', text: 'Esc pauses · M mutes · F fullscreen' }),
  ]);
  const overlay = el('div', { class: 'overlay menu' }, [panel]);
  const unmountPanel = mountPanel(overlay, play);
  return () => {
    settings.dispose();
    unmountPanel();
  };
}

export function showPause(opts: { onResume: () => void; onMenu: () => void }): () => void {
  const settings = settingsControls(() => { void toggleFullscreen(); });
  const resume = button('Resume', opts.onResume, { variant: 'big', icon: 'icon_play', id: 'resume-btn' });
  const panel = el('div', { class: 'panel', role: 'dialog', 'aria-label': 'Paused' }, [
    el('h2', { class: 'heading', text: 'PAUSED' }),
    el('p', { class: 'subheading', text: 'Fuses, spawns, and the clock are frozen.' }),
    el('div', { class: 'btn-col' }, [
      resume,
      button('Main menu', opts.onMenu, { variant: 'ghost', icon: 'icon_home' }),
    ]),
    settings.node,
    el('p', { class: 'kbd-hint', text: 'Esc or Enter to resume' }),
  ]);
  const overlay = el('div', { class: 'overlay' }, [panel]);
  const unmountPanel = mountPanel(overlay, resume);
  return () => {
    settings.dispose();
    unmountPanel();
  };
}

export function showGameOver(opts: {
  summary: RunSummary;
  isNewBest: boolean;
  onAgain: () => void;
  onMenu: () => void;
}): () => void {
  const { summary } = opts;
  const copy = causeCopy(summary);
  const again = button('Play again', opts.onAgain, { variant: 'big', icon: 'icon_restart', id: 'again-btn' });
  const panel = el('div', { class: 'panel', role: 'dialog', 'aria-label': 'Game over' }, [
    el('img', { class: 'go-art', src: assetUrl('assets/svg/gameover_bomb.svg'), alt: '' }),
    el('h2', { class: 'heading danger', text: copy.heading }),
    el('p', { class: 'subheading', text: copy.detail }),
    el('div', { class: 'final-score', text: String(summary.finalScore) }),
    opts.isNewBest ? el('div', { class: 'new-best', text: 'NEW BEST!' }) : el('p', { class: 'best' }, ['Best ', el('b', { text: String(loadBestScore()) })]),
    el('table', { class: 'breakdown' }, [
      el('tr', { class: 'plus' }, [el('td', { text: 'Secured (shipped)' }), el('td', { text: `+${summary.securedBombs}` })]),
      el('tr', { class: 'plus' }, [el('td', { text: 'Safe in other bins' }), el('td', { text: `+${summary.survivorBombs}` })]),
      summary.bonusPoints
        ? el('tr', { class: 'plus' }, [el('td', { text: 'Bonus bombs' }), el('td', { text: `+${summary.bonusPoints}` })])
        : null,
      el('tr', { class: 'minus' }, [el('td', { text: 'Lost in the blast' }), el('td', { text: `−${summary.lostBombs}` })]),
      el('tr', { class: 'total' }, [el('td', { text: 'Final score' }), el('td', { text: String(summary.finalScore) })]),
    ]),
    el('div', { class: 'stats' }, [
      stat('Level', String(summary.levelReached)),
      stat('Sorted', String(summary.totalSorted)),
      stat('Shipped', String(summary.securedBombs)),
      stat('Booms', String(summary.totalExplosions)),
      stat('Time', formatDuration(summary.durationMs)),
    ]),
    el('div', { class: 'btn-row' }, [
      again,
      button('Main menu', opts.onMenu, { variant: 'ghost', icon: 'icon_home' }),
    ]),
  ]);
  const overlay = el('div', { class: 'overlay' }, [panel]);
  return mountPanel(overlay, again);
}

function stat(label: string, value: string): HTMLElement {
  return el('div', { class: 'stat' }, [el('span', { text: label }), el('b', { text: value })]);
}

export function showToast(message: string, ms = 2200): void {
  const root = document.getElementById('ui-root');
  if (!root) return;
  const toast = el('div', { class: 'toast', text: message });
  root.append(toast);
  window.setTimeout(() => toast.remove(), ms);
}
