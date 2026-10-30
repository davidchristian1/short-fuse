// Procedural vector-art generator for Short Fuse.
// Writes every character, prop, effect, and UI illustration as an SVG file in
// public/assets/svg and records sprite metadata (fuse-tip positions) in
// src/assets/bombMeta.json. Output is deterministic: re-running produces identical files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'assets', 'svg');
const META_OUT = join(root, 'src', 'assets', 'bombMeta.json');
mkdirSync(OUT, { recursive: true });
mkdirSync(dirname(META_OUT), { recursive: true });

const INK = '#1d1630';
let written = 0;

function svg(w, h, body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    (defs ? `<defs>${defs}</defs>` : '') + body + '</svg>\n';
}

function save(name, content) {
  writeFileSync(join(OUT, `${name}.svg`), content);
  written++;
}

// Small deterministic PRNG so effects look hand-placed but stay reproducible.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Math.round(n * 100) / 100;

function starPoints(cx, cy, spikes, outer, inner, rotation = 0, rng = null, jitter = 0) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer * (1 - (rng ? rng() * jitter : 0)) : inner;
    const a = rotation + (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${f(cx + Math.cos(a) * r)},${f(cy + Math.sin(a) * r)}`);
  }
  return pts.join(' ');
}

// ---------------------------------------------------------------------------
// Emblems (drawn in a 100x100 box). These are the redundant, non-color
// identifiers for each category, shared by bombs, zones, and menus.
// ---------------------------------------------------------------------------
const EMBLEMS = {
  ember: (sw = 5) => `
    <path d="M50 6 C62 24 80 36 79 60 C78 81 64 93 50 93 C36 93 21 81 21 60 C21 44 33 37 36 22 C42 31 44 37 46 40 C49 29 46 17 50 6 Z" fill="#ff6a1f" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M50 42 C58 53 66 60 64 72 C63 82 57 87 50 87 C43 87 36 82 36 72 C36 62 46 57 50 42 Z" fill="#ffd23a"/>
    <path d="M50 62 C54 68 57 71 56 76 C55 81 53 83 50 83 C47 83 44 81 44 76 C44 71 48 68 50 62 Z" fill="#fff6c8"/>`,
  midnight: (sw = 5) => `
    <path d="M60 8 A43 43 0 1 0 92 70 A35 35 0 0 1 60 8 Z" fill="#ffe27a" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>
    <polygon points="${starPoints(74, 30, 5, 15, 6.5)}" fill="#fff6c4" stroke="${INK}" stroke-width="${sw * 0.7}" stroke-linejoin="round"/>
    <circle cx="36" cy="66" r="4" fill="#e9c14f"/><circle cx="48" cy="80" r="3" fill="#e9c14f"/>`,
  aqua: (sw = 5) => `
    <path d="M50 6 C62 28 81 45 81 64 C81 82 67 94 50 94 C33 94 19 82 19 64 C19 45 38 28 50 6 Z" fill="#2fb8f5" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M27 68 Q35 59 43 68 T59 68 T75 68" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="38" cy="47" rx="6" ry="10" fill="#d9f6ff" transform="rotate(25 38 47)"/>`,
  moss: (sw = 5) => `
    <path d="M16 84 C16 40 46 12 88 12 C88 56 60 86 16 84 Z" fill="#3cae38" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M20 80 Q50 52 80 20" fill="none" stroke="#e2ffb8" stroke-width="5" stroke-linecap="round"/>
    <path d="M42 58 L36 40 M56 44 L52 28 M50 62 L68 62 M62 48 L78 46" fill="none" stroke="#e2ffb8" stroke-width="3.5" stroke-linecap="round"/>`,
};

// ---------------------------------------------------------------------------
// Bomb characters (128x128 canvas, transparent background)
// ---------------------------------------------------------------------------
const BOMBS = {
  ember: {
    light: '#ffd27a', mid: '#ff7a33', dark: '#c0281b', rim: '#ffe7b8',
    shoe: '#e0332a', sole: '#fff1dc', iris: '#2c140a', blush: '#ff9a7a',
    top: 30, eyeY: 56, mouthY: 72, badgeY: 93, foot: 'sneaker',
  },
  midnight: {
    light: '#7586d4', mid: '#2f3b7c', dark: '#11173a', rim: '#a9bcff',
    shoe: '#8a5ae0', sole: '#3a2766', iris: '#ffd23f', blush: '#7a6ad6',
    top: 30, eyeY: 57, mouthY: 73, badgeY: 94, foot: 'slipper',
  },
  aqua: {
    light: '#c4fcff', mid: '#38cfe6', dark: '#0f6fa6', rim: '#eafeff',
    shoe: '#2aa3c8', sole: '#d2f8ff', iris: '#0a3f62', blush: '#ff9bb8',
    top: 22, eyeY: 62, mouthY: 77, badgeY: 96, foot: 'flipper',
  },
  moss: {
    light: '#d8f9a0', mid: '#69c84a', dark: '#28772a', rim: '#efffd0',
    shoe: '#7c4b27', sole: '#3a2210', iris: '#1d3810', blush: '#ff9f8a',
    top: 36, eyeY: 61, mouthY: 75, badgeY: 94, foot: 'boot',
  },
};

function bodyShape(cat) {
  switch (cat) {
    case 'ember': return '<circle cx="64" cy="70" r="40"/>';
    case 'midnight': return '<ellipse cx="64" cy="71" rx="35" ry="41"/>';
    case 'aqua': return '<path d="M64 22 C80 40 104 56 104 79 C104 100 86 113 64 113 C42 113 24 100 24 79 C24 56 48 40 64 22 Z"/>';
    case 'moss': return '<rect x="21" y="36" width="86" height="74" rx="30"/>';
    default: throw new Error(cat);
  }
}

// Decorations drawn behind the body that give each category a unique silhouette.
function backDecor(cat, c) {
  switch (cat) {
    case 'ember':
      return `<path d="M34 48 C26 36 32 24 38 16 C39 26 45 27 46 33 C48 24 54 20 54 13 C62 24 60 36 54 44 Z" fill="${c.mid}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M40 44 C36 36 39 30 42 26 C43 32 47 33 48 36 C50 31 52 28 53 25 C56 32 54 38 50 43 Z" fill="#ffd23a"/>`;
    case 'midnight':
      return `<path d="M36 48 L30 16 L56 36 Z" fill="${c.mid}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M92 48 L98 16 L72 36 Z" fill="${c.mid}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M37 40 L34 24 L47 34 Z M91 40 L94 24 L81 34 Z" fill="#8f7ae6"/>`;
    case 'aqua':
      return '';
    case 'moss':
      return `<path d="M50 40 C38 36 30 24 32 12 C44 14 52 24 52 38 Z" fill="#4fb53a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M50 38 C48 28 42 20 34 16" fill="none" stroke="#d6ff9e" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M54 40 C56 28 66 22 76 22 C76 32 68 40 56 41 Z" fill="#3c9a2e" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    default: return '';
  }
}

// Surface details drawn on top of the body fill (before the face).
function frontDecor(cat, c) {
  switch (cat) {
    case 'ember':
      return `<path d="M30 84 Q36 90 42 86 M86 86 Q92 90 98 84" fill="none" stroke="${c.dark}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`;
    case 'midnight':
      return `<polygon points="${starPoints(40, 84, 4, 4, 1.5)}" fill="#ffe9a0" opacity="0.9"/>
        <polygon points="${starPoints(90, 76, 4, 3.5, 1.4)}" fill="#ffe9a0" opacity="0.8"/>
        <polygon points="${starPoints(84, 98, 4, 3, 1.2)}" fill="#ffe9a0" opacity="0.7"/>`;
    case 'aqua':
      return `<path d="M27 92 Q37 84 46 92 T64 92 T82 92 T101 92 L102 98 Q83 106 64 106 Q44 106 26 98 Z" fill="#e8fdff" opacity="0.9"/>
        <path d="M27 92 Q37 84 46 92 T64 92 T82 92 T101 92" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'moss':
      return `<circle cx="32" cy="80" r="4" fill="${c.dark}" opacity="0.45"/><circle cx="96" cy="66" r="5" fill="${c.dark}" opacity="0.45"/>
        <circle cx="92" cy="96" r="3" fill="${c.dark}" opacity="0.45"/><circle cx="38" cy="100" r="3" fill="${c.dark}" opacity="0.45"/>`;
    default: return '';
  }
}

function footShape(style, c) {
  switch (style) {
    case 'sneaker':
      return `<path d="M-13 2 C-14 -8 -4 -9 2 -8 C9 -7 15 -3 15 3 C15 7 10 8 0 8 C-8 8 -13 7 -13 2 Z" fill="${c.shoe}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M-12 4 L14 4" stroke="${c.sole}" stroke-width="3" stroke-linecap="round"/>`;
    case 'slipper':
      return `<path d="M-12 6 C-14 -4 -6 -8 2 -7 C8 -6 12 -4 15 -8 C19 -12 23 -9 20 -4 C17 2 12 7 2 8 C-6 9 -11 9 -12 6 Z" fill="${c.shoe}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
        <circle cx="21" cy="-9" r="3" fill="#ffe27a" stroke="${INK}" stroke-width="2"/>`;
    case 'flipper':
      return `<path d="M-10 -6 C2 -9 14 -6 21 2 C23 8 17 9 13 7 C10 10 6 10 3 7 C0 10 -5 10 -7 7 C-13 8 -15 4 -14 0 C-14 -3 -12 -5 -10 -6 Z" fill="${c.shoe}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M5 -3 L9 6 M13 -1 L16 5" stroke="${c.sole}" stroke-width="2" stroke-linecap="round"/>`;
    case 'boot':
      return `<path d="M-12 -9 L5 -9 C7 -4 10 -2 15 -1 C19 1 19 8 14 9 L-12 9 C-14 3 -14 -4 -12 -9 Z" fill="${c.shoe}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M-12 6 L17 6" stroke="${c.sole}" stroke-width="3.5" stroke-linecap="round"/>`;
    default: throw new Error(style);
  }
}

function feet(cat, c, frame) {
  // frame 0: planted; frame 1: mid-step (left foot lifted, right foot forward)
  const left = frame === 0 ? { x: 46, y: 109, r: 0 } : { x: 43, y: 104, r: -18 };
  const right = frame === 0 ? { x: 82, y: 109, r: 0 } : { x: 85, y: 110, r: 6 };
  const shape = footShape(c.foot, c);
  return `<g transform="translate(${left.x} ${left.y}) rotate(${left.r}) scale(-1 1)">${shape}</g>` +
    `<g transform="translate(${right.x} ${right.y}) rotate(${right.r})">${shape}</g>`;
}

function eyesFor(cat, c, expr) {
  const { eyeY } = c;
  const L = 51, R = 77;
  const big = expr === 'drag' || expr === 'panic';
  const scl = cat === 'aqua' ? { rx: 10, ry: 12 } : cat === 'moss' ? { rx: 8.5, ry: 9.5 } : { rx: 9, ry: 11 };
  if (big) { scl.rx += 1.5; scl.ry += 1.5; }

  if (expr === 'blink') {
    return [L, R].map((x) => `<path d="M${x - 8} ${eyeY + 1} Q${x} ${eyeY + 7} ${x + 8} ${eyeY + 1}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`).join('');
  }
  if (expr === 'happy') {
    return [L, R].map((x) => `<path d="M${x - 8} ${eyeY + 3} Q${x} ${eyeY - 8} ${x + 8} ${eyeY + 3}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`).join('');
  }

  let out = '';
  for (const x of [L, R]) {
    out += `<ellipse cx="${x}" cy="${eyeY}" rx="${scl.rx}" ry="${scl.ry}" fill="#ffffff" stroke="${INK}" stroke-width="3"/>`;
    const lookUp = expr === 'drag' ? -3 : 0;
    const pr = big ? 3.6 : cat === 'aqua' ? 6.2 : 5;
    const px = x + (expr === 'panic' ? (x === L ? 1.5 : -1.5) : 1.5);
    const py = eyeY + 2 + lookUp;
    if (cat === 'midnight' && !big) {
      out += `<circle cx="${px}" cy="${py}" r="${pr + 1}" fill="${c.iris}"/><ellipse cx="${px}" cy="${py}" rx="1.6" ry="${pr}" fill="${INK}"/>`;
    } else {
      out += `<circle cx="${px}" cy="${py}" r="${pr}" fill="${cat === 'midnight' ? INK : c.iris}"/>`;
    }
    out += `<circle cx="${px - pr * 0.4}" cy="${py - pr * 0.45}" r="${Math.max(1.4, pr * 0.38)}" fill="#ffffff"/>`;
    if (cat === 'aqua' && !big) out += `<circle cx="${px + 2.5}" cy="${py + 2.5}" r="1.2" fill="#ffffff"/>`;
    if (cat === 'midnight' && !big) {
      // heavy, sleepy upper lids
      out += `<path d="M${x - scl.rx - 1} ${eyeY - 1} Q${x} ${eyeY - scl.ry - 6} ${x + scl.rx + 1} ${eyeY - 1} Q${x} ${eyeY - 4} ${x - scl.rx - 1} ${eyeY - 1} Z" fill="${c.mid}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    }
  }
  return out;
}

function browsFor(cat, c, expr) {
  const y = c.eyeY - 14;
  if (expr === 'happy' || expr === 'blink') {
    if (cat === 'moss') return `<path d="M41 ${y + 1} L60 ${y + 1} M68 ${y + 1} L87 ${y + 1}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    return '';
  }
  if (expr === 'panic') {
    return `<path d="M42 ${y + 2} L59 ${y - 4} M86 ${y + 2} L69 ${y - 4}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (expr === 'drag') {
    return `<path d="M42 ${y - 2} Q50 ${y - 8} 59 ${y - 3} M69 ${y - 3} Q78 ${y - 8} 86 ${y - 2}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
  }
  switch (cat) {
    case 'ember': return `<path d="M41 ${y - 2} L59 ${y + 4} M87 ${y - 2} L69 ${y + 4}" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
    case 'moss': return `<path d="M40 ${y + 2} L60 ${y} M68 ${y} L88 ${y + 2}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    case 'aqua': return `<path d="M44 ${y - 3} Q51 ${y - 7} 58 ${y - 4} M70 ${y - 4} Q77 ${y - 7} 84 ${y - 3}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    default: return '';
  }
}

function mouthFor(cat, c, expr) {
  const y = c.mouthY;
  switch (expr) {
    case 'happy':
      return `<path d="M52 ${y - 2} Q64 ${y + 14} 76 ${y - 2} Z" fill="#7a1f2b" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M58 ${y + 6} Q64 ${y + 2} 70 ${y + 6} Q64 ${y + 10} 58 ${y + 6} Z" fill="#ff7d93"/>
        <ellipse cx="38" cy="${y - 4}" rx="6" ry="3.5" fill="${c.blush}" opacity="0.75"/><ellipse cx="90" cy="${y - 4}" rx="6" ry="3.5" fill="${c.blush}" opacity="0.75"/>`;
    case 'drag':
      return `<ellipse cx="64" cy="${y + 3}" rx="5.5" ry="7" fill="#7a1f2b" stroke="${INK}" stroke-width="3"/>`;
    case 'panic':
      return `<path d="M50 ${y + 6} Q50 ${y - 2} 64 ${y - 2} Q78 ${y - 2} 78 ${y + 6} Q64 ${y + 10} 50 ${y + 6} Z" fill="#ffffff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M52 ${y + 3} L56 ${y} L60 ${y + 4} L64 ${y} L68 ${y + 4} L72 ${y} L76 ${y + 3}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M95 ${c.eyeY - 16} C99 ${c.eyeY - 9} 101 ${c.eyeY - 5} 97 ${c.eyeY - 2} C93 ${c.eyeY} 90 ${c.eyeY - 4} 92 ${c.eyeY - 8} Z" fill="#9fe8ff" stroke="${INK}" stroke-width="2"/>`;
    default:
      switch (cat) {
        case 'ember':
          return `<path d="M53 ${y} Q64 ${y + 11} 77 ${y - 2} Q65 ${y + 3} 53 ${y} Z" fill="#ffffff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
        case 'midnight':
          return `<path d="M57 ${y + 1} Q65 ${y + 5} 72 ${y - 2}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
        case 'aqua':
          return `<path d="M57 ${y} Q64 ${y + 9} 71 ${y} Z" fill="#7a1f2b" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
            <ellipse cx="40" cy="${y - 3}" rx="5.5" ry="3" fill="${c.blush}" opacity="0.7"/><ellipse cx="88" cy="${y - 3}" rx="5.5" ry="3" fill="${c.blush}" opacity="0.7"/>`;
        case 'moss':
          return `<path d="M54 ${y + 2} Q59 ${y - 1} 64 ${y + 2} Q69 ${y + 5} 74 ${y + 2}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
            <rect x="60" y="${y + 2}" width="5" height="4" rx="1" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/>`;
        default: return '';
      }
  }
}

const FUSE_META = {};

function bombSvg(cat, expr, frame) {
  const c = BOMBS[cat];
  const capY = c.top - 9;
  const tip = { x: 74, y: capY - 14 };
  FUSE_META[cat] = { tipX: tip.x, tipY: tip.y, size: 128 };
  const defs = `
    <radialGradient id="body" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="${c.light}"/><stop offset="0.45" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b93a8"/><stop offset="0.45" stop-color="#f1f3f8"/><stop offset="1" stop-color="#6b7389"/></linearGradient>
    <clipPath id="bodyClip">${bodyShape(cat)}</clipPath>`;
  const shape = bodyShape(cat);
  const body = `
    <ellipse cx="64" cy="119" rx="32" ry="6" fill="#000000" opacity="0.22"/>
    ${feet(cat, c, frame)}
    ${backDecor(cat, c)}
    <g fill="${INK}" transform="translate(0 0)">${shape.replace('/>', ` stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>`)}</g>
    <g fill="url(#body)">${shape}</g>
    <g clip-path="url(#bodyClip)">
      <ellipse cx="86" cy="104" rx="46" ry="26" fill="${c.dark}" opacity="0.35"/>
      ${frontDecor(cat, c)}
    </g>
    <g fill="none" stroke="${c.rim}" stroke-width="2.5" opacity="0.5" transform="translate(64 72) scale(0.9) translate(-64 -72)">${shape}</g>
    <ellipse cx="45" cy="${c.top + 16}" rx="11" ry="6" fill="#ffffff" opacity="0.6" transform="rotate(-32 45 ${c.top + 16})"/>
    <circle cx="36" cy="${c.top + 28}" r="3" fill="#ffffff" opacity="0.55"/>
    <rect x="55" y="${capY}" width="18" height="12" rx="3" fill="url(#metal)" stroke="${INK}" stroke-width="3"/>
    <path d="M64 ${capY + 1} C61 ${capY - 6} 70 ${capY - 8} ${tip.x} ${tip.y}" fill="none" stroke="#5a381c" stroke-width="5" stroke-linecap="round"/>
    <path d="M64 ${capY + 1} C61 ${capY - 6} 70 ${capY - 8} ${tip.x} ${tip.y}" fill="none" stroke="#d29a5e" stroke-width="1.6" stroke-dasharray="2 3"/>
    <circle cx="${tip.x}" cy="${tip.y}" r="2.6" fill="#2a1a10"/>
    <circle cx="64" cy="${c.badgeY}" r="14" fill="#fff8ea" stroke="${INK}" stroke-width="3"/>
    <g transform="translate(${64 - 11.5} ${c.badgeY - 11.5}) scale(0.23)">${EMBLEMS[cat](7)}</g>
    ${browsFor(cat, c, expr)}
    ${eyesFor(cat, c, expr)}
    ${mouthFor(cat, c, expr)}`;
  return svg(128, 128, body, defs);
}

const BOMB_FRAMES = [
  ['walk0', 'idle', 0], ['walk1', 'idle', 1], ['blink', 'blink', 0], ['drag', 'drag', 0],
  ['panic0', 'panic', 0], ['panic1', 'panic', 1], ['happy', 'happy', 0],
];

for (const cat of Object.keys(BOMBS)) {
  for (const [name, expr, frame] of BOMB_FRAMES) save(`bomb_${cat}_${name}`, bombSvg(cat, expr, frame));
  save(`emblem_${cat}`, emblemSvg(cat));
  save(`zone_${cat}`, zoneFrameSvg(cat));
}

function emblemSvg(cat) {
  const c = BOMBS[cat];
  return svg(128, 128, `
    <circle cx="64" cy="64" r="60" fill="${INK}"/>
    <circle cx="64" cy="64" r="55" fill="${c.mid}"/>
    <circle cx="64" cy="64" r="46" fill="#fff8ea"/>
    <path d="M26 46 A44 44 0 0 1 82 22" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
    <g transform="translate(26 26) scale(0.76)">${EMBLEMS[cat](6)}</g>`);
}

// Nine-slice frame (corners 44px) for a sorting zone. Center is a flat fill so it stretches cleanly.
function zoneFrameSvg(cat) {
  const c = BOMBS[cat];
  const bolts = [[17, 17], [175, 17], [17, 175], [175, 175]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#eef0f6" stroke="${INK}" stroke-width="2.5"/><path d="M${x - 3} ${y} L${x + 3} ${y}" stroke="${INK}" stroke-width="1.5"/>`).join('');
  return svg(192, 192, `
    <rect x="3" y="3" width="186" height="186" rx="30" fill="${INK}"/>
    <rect x="8" y="8" width="176" height="176" rx="26" fill="${c.mid}"/>
    <rect x="8" y="8" width="176" height="20" rx="10" fill="#ffffff" opacity="0.18"/>
    <rect x="24" y="24" width="144" height="144" rx="16" fill="${INK}"/>
    <rect x="27" y="27" width="138" height="138" rx="14" fill="${c.dark}"/>
    ${bolts}`);
}

// ---------------------------------------------------------------------------
// Spark animation frames (64x64)
// ---------------------------------------------------------------------------
for (let i = 0; i < 4; i++) {
  const rng = mulberry32(100 + i);
  const rot = (i * Math.PI) / 9;
  const outer = [26, 22, 28, 20][i];
  save(`spark_${i}`, svg(64, 64, `
    <circle cx="32" cy="32" r="${outer * 0.7}" fill="#ffb02e" opacity="0.35"/>
    <polygon points="${starPoints(32, 32, 8, outer, outer * 0.38, rot, rng, 0.35)}" fill="#ffcf3a" stroke="#e8571c" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="${starPoints(32, 32, 6, outer * 0.55, outer * 0.25, -rot, rng, 0.2)}" fill="#fff7c2"/>
    <circle cx="32" cy="32" r="4.5" fill="#ffffff"/>`));
}

// ---------------------------------------------------------------------------
// Explosion frames (256x256): flash -> starburst -> puffs -> dissipating smoke
// ---------------------------------------------------------------------------
function cloud(puffs, fill, highlight) {
  return puffs.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r + 5)}" fill="${INK}"/>`).join('') +
    puffs.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"/>`).join('') +
    (highlight ? puffs.map(([x, y, r]) => `<circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.45)}" fill="${highlight}" opacity="0.6"/>`).join('') : '');
}

function ringPuffs(cx, cy, count, dist, r, rng, jitter = 0.25) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + rng() * 0.4;
    const d = dist * (1 - jitter / 2 + rng() * jitter);
    out.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.75 + rng() * 0.5)]);
  }
  return out;
}

function debris(cx, cy, count, dist, rng, color = '#4a3b5c') {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + rng() * 0.6;
    const d = dist * (0.8 + rng() * 0.4);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const kind = i % 3;
    if (kind === 0) out += `<rect x="${f(x - 5)}" y="${f(y - 3)}" width="10" height="6" rx="1.5" fill="${color}" stroke="${INK}" stroke-width="2" transform="rotate(${Math.round(rng() * 180)} ${f(x)} ${f(y)})"/>`;
    else if (kind === 1) out += `<polygon points="${starPoints(x, y, 4, 7, 2.5, rng())}" fill="#fff2a8" stroke="${INK}" stroke-width="1.5"/>`;
    else out += `<circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#ff8a3a" stroke="${INK}" stroke-width="2"/>`;
  }
  return out;
}

{
  const C = 128;
  const frames = [];
  let rng = mulberry32(7);
  frames.push(`<circle cx="${C}" cy="${C}" r="56" fill="#fff6c8" opacity="0.6"/>
    <polygon points="${starPoints(C, C, 10, 70, 38, 0, rng, 0.3)}" fill="#ffe14d" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="${C}" cy="${C}" r="26" fill="#ffffff"/>`);
  rng = mulberry32(8);
  frames.push(`<polygon points="${starPoints(C, C, 12, 116, 62, 0.2, rng, 0.25)}" fill="#ff8a2a" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="${starPoints(C, C, 9, 80, 44, 0.5, rng, 0.2)}" fill="#ffe14d"/>
    <circle cx="${C}" cy="${C}" r="32" fill="#ffffff"/>`);
  rng = mulberry32(9);
  frames.push(`<polygon points="${starPoints(C, C, 12, 120, 74, 0.35, rng, 0.2)}" fill="#ffb04a" stroke="${INK}" stroke-width="6" stroke-linejoin="round" opacity="0.95"/>
    ${cloud(ringPuffs(C, C, 8, 52, 30, rng), '#ffd27a', '#ffffff')}
    <circle cx="${C}" cy="${C}" r="30" fill="#fff4c4"/>
    ${debris(C, C, 9, 112, rng)}`);
  rng = mulberry32(10);
  frames.push(`${cloud([...ringPuffs(C, C, 9, 66, 34, rng), [C, C, 44]], '#f4a07a', '#ffe0b8')}
    ${debris(C, C, 10, 120, rng)}`);
  rng = mulberry32(11);
  frames.push(`${cloud([...ringPuffs(C, C - 6, 9, 78, 30, rng), [C, C - 8, 40]], '#c9b8dc', '#ffffff')}`);
  rng = mulberry32(12);
  frames.push(`<g opacity="0.75">${cloud(ringPuffs(C, C - 14, 6, 88, 22, rng, 0.5), '#e3dcef', '#ffffff')}</g>`);
  frames.forEach((body, i) => save(`explosion_${i}`, svg(256, 256, body)));
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
{
  const rng = mulberry32(21);
  save('smoke_puff', svg(64, 64, cloud([[32, 34, 16], [20, 38, 10], [44, 38, 11], [30, 24, 10]], '#d8d0e6', '#ffffff')));
  save('debris_gear', svg(32, 32, `<polygon points="${starPoints(16, 16, 8, 14, 10)}" fill="#9aa3b8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="16" cy="16" r="4.5" fill="${INK}"/>`));
  save('debris_bolt', svg(32, 32, `<rect x="12" y="4" width="8" height="20" rx="2" fill="#c7ccd8" stroke="${INK}" stroke-width="2.5"/><rect x="7" y="20" width="18" height="8" rx="2" fill="#8f97ad" stroke="${INK}" stroke-width="2.5"/>`));
  save('debris_star', svg(32, 32, `<polygon points="${starPoints(16, 16, 5, 14, 6, 0, rng, 0)}" fill="#ffe14d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`));
  save('particle_glow', svg(32, 32, `<circle cx="16" cy="16" r="14" fill="#fff2a8" opacity="0.35"/><circle cx="16" cy="16" r="8" fill="#fff8d8"/><circle cx="16" cy="16" r="4" fill="#ffffff"/>`));
  save('sparkle', svg(48, 48, `<polygon points="${starPoints(24, 24, 4, 22, 5)}" fill="#ffffff" stroke="#ffd23a" stroke-width="2.5" stroke-linejoin="round"/>`));
  save('confetti', svg(16, 24, `<rect x="2" y="2" width="12" height="20" rx="3" fill="#ffffff" stroke="${INK}" stroke-width="2"/>`));
}

// ---------------------------------------------------------------------------
// Entry doors (200x180): two distinct designs, each with closed/open states,
// plus a locked state for the second door.
// ---------------------------------------------------------------------------
function doorA(state) {
  const defs = `<linearGradient id="hA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd257"/><stop offset="1" stop-color="#e08a1c"/></linearGradient>
    <linearGradient id="inA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120c22"/><stop offset="1" stop-color="#5a2a1a"/></linearGradient>
    <clipPath id="openA"><path d="M36 180 L36 74 Q36 38 100 38 Q164 38 164 74 L164 180 Z"/></clipPath>`;
  let shutter = '';
  if (state === 'closed') {
    let slats = '';
    for (let y = 40; y < 180; y += 14) slats += `<rect x="30" y="${y}" width="140" height="14" fill="${(y / 14) % 2 ? '#e2552f' : '#cf4527'}"/><path d="M30 ${y + 13} L170 ${y + 13}" stroke="#8c2a1a" stroke-width="2"/>`;
    shutter = `<g clip-path="url(#openA)">${slats}
      <rect x="30" y="150" width="140" height="30" fill="#ffd23a"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${22 + i * 28} 180 L${42 + i * 28} 150 L${54 + i * 28} 150 L${34 + i * 28} 180 Z" fill="${INK}"/>`).join('')}
      <rect x="88" y="132" width="24" height="8" rx="4" fill="#ffe7a8" stroke="${INK}" stroke-width="2.5"/></g>`;
  } else {
    shutter = `<g clip-path="url(#openA)"><rect x="30" y="38" width="140" height="142" fill="url(#inA)"/>
      ${[100, 124, 148, 172].map((y) => `<rect x="44" y="${y}" width="112" height="9" rx="4.5" fill="#3b2a48" stroke="#120c22" stroke-width="2"/>`).join('')}
      <ellipse cx="100" cy="170" rx="70" ry="24" fill="#ffb347" opacity="0.35"/>
      <rect x="30" y="38" width="140" height="24" fill="#cf4527"/><path d="M30 50 L170 50" stroke="#8c2a1a" stroke-width="2"/></g>`;
  }
  return svg(200, 180, `
    <path d="M8 180 L8 66 Q8 8 100 8 Q192 8 192 66 L192 180 Z" fill="${INK}"/>
    <path d="M14 180 L14 68 Q14 14 100 14 Q186 14 186 68 L186 180 Z" fill="url(#hA)"/>
    <path d="M22 60 Q30 24 100 22" fill="none" stroke="#fff3c4" stroke-width="5" stroke-linecap="round" opacity="0.7"/>
    <path d="M30 180 L30 72 Q30 32 100 32 Q170 32 170 72 L170 180 Z" fill="${INK}"/>
    ${shutter}
    ${[[22, 90], [22, 130], [22, 168], [178, 90], [178, 130], [178, 168]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff0c0" stroke="${INK}" stroke-width="2"/>`).join('')}
    <circle cx="100" cy="16" r="11" fill="${INK}"/>
    <circle cx="100" cy="16" r="7.5" fill="${state === 'open' ? '#7dff6a' : '#ffb02e'}"/>
    <circle cx="97" cy="13" r="2.5" fill="#ffffff"/>
    <path d="M86 46 L100 58 L114 46" fill="none" stroke="${state === 'open' ? '#ffe7a8' : '#ffd23a'}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="${state === 'open' ? 0.9 : 0}"/>`, defs);
}

function doorB(state) {
  const defs = `<linearGradient id="hB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fe0d0"/><stop offset="1" stop-color="#1b6f86"/></linearGradient>
    <linearGradient id="pnl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f8fb8"/><stop offset="1" stop-color="#4a5880"/></linearGradient>
    <linearGradient id="inB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1426"/><stop offset="1" stop-color="#14465a"/></linearGradient>
    <clipPath id="openB"><rect x="40" y="42" width="120" height="138" rx="14"/></clipPath>`;
  let inner;
  if (state === 'open') {
    inner = `<g clip-path="url(#openB)"><rect x="40" y="42" width="120" height="138" fill="url(#inB)"/>
      <ellipse cx="100" cy="172" rx="64" ry="26" fill="#58f0ff" opacity="0.28"/>
      ${[86, 110, 134, 158].map((y) => `<path d="M48 ${y} L152 ${y}" stroke="#1d5f74" stroke-width="5" stroke-linecap="round"/>`).join('')}
      <rect x="40" y="42" width="16" height="138" fill="url(#pnl)" stroke="${INK}" stroke-width="3"/>
      <rect x="144" y="42" width="16" height="138" fill="url(#pnl)" stroke="${INK}" stroke-width="3"/></g>`;
  } else {
    inner = `<g clip-path="url(#openB)">
      <rect x="40" y="42" width="60" height="138" fill="url(#pnl)" stroke="${INK}" stroke-width="3"/>
      <rect x="100" y="42" width="60" height="138" fill="url(#pnl)" stroke="${INK}" stroke-width="3"/>
      <circle cx="70" cy="86" r="14" fill="#1b2a4a" stroke="${INK}" stroke-width="3"/><circle cx="130" cy="86" r="14" fill="#1b2a4a" stroke="${INK}" stroke-width="3"/>
      <path d="M64 80 L70 76 M124 80 L130 76" stroke="#9fefff" stroke-width="3" stroke-linecap="round"/>
      ${[118, 136, 154, 172].map((y) => `<path d="M48 ${y} L92 ${y} M108 ${y} L152 ${y}" stroke="#36446a" stroke-width="3"/>`).join('')}</g>`;
    if (state === 'locked') {
      inner += `<path d="M38 70 L162 150" stroke="${INK}" stroke-width="20" stroke-linecap="round"/><path d="M38 70 L162 150" stroke="#c98a4a" stroke-width="14" stroke-linecap="round"/>
        <path d="M162 70 L38 150" stroke="${INK}" stroke-width="20" stroke-linecap="round"/><path d="M162 70 L38 150" stroke="#d99a58" stroke-width="14" stroke-linecap="round"/>
        <path d="M88 112 L88 100 Q100 86 112 100 L112 112" fill="none" stroke="${INK}" stroke-width="9"/><path d="M88 112 L88 100 Q100 88 112 100 L112 112" fill="none" stroke="#c7ccd8" stroke-width="4"/>
        <rect x="82" y="108" width="36" height="28" rx="6" fill="#ffd23a" stroke="${INK}" stroke-width="3.5"/><circle cx="100" cy="120" r="4" fill="${INK}"/>`;
    }
  }
  const light = state === 'open' ? '#7dff6a' : state === 'locked' ? '#ff4a4a' : '#58f0ff';
  return svg(200, 180, `
    <rect x="18" y="12" width="164" height="168" rx="24" fill="${INK}"/>
    <rect x="24" y="18" width="152" height="162" rx="20" fill="url(#hB)"/>
    <path d="M32 30 L168 30" stroke="#d6fff8" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
    <rect x="36" y="38" width="128" height="142" rx="16" fill="${INK}"/>
    ${inner}
    ${[[30, 50], [30, 100], [30, 150], [170, 50], [170, 100], [170, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#d6fff8" stroke="${INK}" stroke-width="2"/>`).join('')}
    <rect x="2" y="60" width="18" height="40" rx="6" fill="#ff7a5c" stroke="${INK}" stroke-width="3.5"/>
    <rect x="180" y="60" width="18" height="40" rx="6" fill="#ff7a5c" stroke="${INK}" stroke-width="3.5"/>
    <rect x="80" y="2" width="40" height="22" rx="10" fill="${INK}"/>
    <rect x="85" y="6" width="30" height="14" rx="7" fill="${light}"/>
    <rect x="89" y="8" width="8" height="4" rx="2" fill="#ffffff" opacity="0.8"/>`, defs);
}

save('door_a_closed', doorA('closed'));
save('door_a_open', doorA('open'));
save('door_b_closed', doorB('closed'));
save('door_b_open', doorB('open'));
save('door_b_locked', doorB('locked'));

// ---------------------------------------------------------------------------
// Special-bomb badges (64x64)
// ---------------------------------------------------------------------------
function badge(inner, ring) {
  return svg(64, 64, `<circle cx="32" cy="32" r="29" fill="${INK}"/><circle cx="32" cy="32" r="25" fill="${ring}"/>${inner}`);
}
save('badge_heavy', badge(`<path d="M20 50 L24 28 L40 28 L44 50 Z" fill="#5d6680" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M25 28 Q25 14 32 14 Q39 14 39 28" fill="none" stroke="${INK}" stroke-width="7"/><path d="M25 28 Q25 14 32 14 Q39 14 39 28" fill="none" stroke="#8a93ad" stroke-width="3"/>
  <rect x="24" y="36" width="16" height="6" rx="2" fill="#c7ccd8"/>`, '#c7ccd8'));
save('badge_speedy', badge(`<path d="M36 10 L20 36 L31 36 L26 54 L45 26 L34 26 Z" fill="#ffe14d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M8 26 L16 26 M6 34 L15 34 M9 42 L17 42" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>`, '#3f8cff'));
save('badge_shortfuse', badge(`<circle cx="32" cy="35" r="16" fill="#ffffff" stroke="${INK}" stroke-width="3"/>
  <path d="M32 35 L32 25 M32 35 L39 39" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <path d="M16 20 Q18 12 26 13 M48 20 Q46 12 38 13" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M22 52 L18 57 M42 52 L46 57" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`, '#ff4a4a'));
save('badge_bonus', badge(`<polygon points="${starPoints(32, 33, 5, 19, 8.5)}" fill="#ffe14d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M28 33 L36 33 M32 29 L32 37" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`, '#ffb02e'));

// ---------------------------------------------------------------------------
// UI: icons (64x64), round button states, title burst, game-over art
// ---------------------------------------------------------------------------
function icon(glyph) {
  // Glyph drawn twice: thick ink outline underneath, white fill on top.
  return svg(64, 64, `<g stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" fill="${INK}">${glyph}</g>
    <g fill="#ffffff" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">${glyph}</g>`);
}
function strokeIcon(glyph) {
  return svg(64, 64, `<g fill="none" stroke="${INK}" stroke-width="11" stroke-linejoin="round" stroke-linecap="round">${glyph}</g>
    <g fill="none" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${glyph}</g>`);
}
save('icon_pause', icon('<rect x="16" y="13" width="11" height="38" rx="3"/><rect x="37" y="13" width="11" height="38" rx="3"/>'));
save('icon_play', icon('<path d="M20 12 L52 32 L20 52 Z"/>'));
save('icon_sound_on', svg(64, 64, `
  <g stroke="${INK}" stroke-width="7" stroke-linejoin="round" fill="${INK}"><path d="M8 25 L19 25 L33 12 L33 52 L19 39 L8 39 Z"/></g>
  <g fill="#ffffff"><path d="M8 25 L19 25 L33 12 L33 52 L19 39 L8 39 Z"/></g>
  <g fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"><path d="M41 24 Q47 32 41 40"/><path d="M47 15 Q60 32 47 49"/></g>
  <g fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"><path d="M41 24 Q47 32 41 40"/><path d="M47 15 Q60 32 47 49"/></g>`));
save('icon_sound_off', svg(64, 64, `
  <g stroke="${INK}" stroke-width="7" stroke-linejoin="round" fill="${INK}"><path d="M8 25 L19 25 L33 12 L33 52 L19 39 L8 39 Z"/></g>
  <g fill="#ffffff"><path d="M8 25 L19 25 L33 12 L33 52 L19 39 L8 39 Z"/></g>
  <g fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"><path d="M41 23 L56 41 M56 23 L41 41"/></g>
  <g fill="none" stroke="#ff6a5a" stroke-width="4.5" stroke-linecap="round"><path d="M41 23 L56 41 M56 23 L41 41"/></g>`));
save('icon_fullscreen', strokeIcon('<path d="M12 24 L12 12 L24 12 M40 12 L52 12 L52 24 M52 40 L52 52 L40 52 M24 52 L12 52 L12 40"/>'));
save('icon_home', icon('<path d="M10 32 L32 12 L54 32 L48 32 L48 52 L36 52 L36 40 L28 40 L28 52 L16 52 L16 32 Z"/>'));
save('icon_restart', svg(64, 64, `
  <g fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"><path d="M48 34 A16 16 0 1 1 40 19"/></g>
  <g fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"><path d="M48 34 A16 16 0 1 1 40 19"/></g>
  <path d="M34 8 L52 16 L38 28 Z" fill="#ffffff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`));
save('icon_settings', svg(64, 64, `<polygon points="${starPoints(32, 32, 8, 27, 20)}" fill="#ffffff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="32" r="9" fill="${INK}"/>`));

function roundButton(top, bottom, ring, pressed = false) {
  const off = pressed ? 4 : 0;
  return svg(96, 96, `
    <circle cx="48" cy="52" r="42" fill="${INK}"/>
    ${pressed ? '' : `<circle cx="48" cy="52" r="38" fill="${ring}"/>`}
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
    <circle cx="48" cy="${44 + off}" r="38" fill="${INK}"/>
    <circle cx="48" cy="${44 + off}" r="34" fill="url(#g)"/>
    <path d="M24 ${34 + off} A28 28 0 0 1 60 ${18 + off}" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.55"/>`);
}
save('button_round', roundButton('#ffd257', '#f08a1c', '#a8520f'));
save('button_round_hover', roundButton('#ffe58a', '#ffa23a', '#b8621f'));
save('button_round_pressed', roundButton('#f0b840', '#d8701a', '#a8520f', true));

{
  const rng = mulberry32(31);
  save('title_burst', svg(960, 420, `
    <polygon points="${starPoints(480, 230, 22, 230, 150, 0, rng, 0.18)}" fill="#ffb02e" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="${starPoints(480, 230, 18, 180, 130, 0.2, rng, 0.15)}" fill="#ff6a3d"/>
    <ellipse cx="480" cy="230" rx="300" ry="96" fill="#ffe14d" opacity="0.25"/>`));
}

// Collection stamp shown when a zone ships a full batch.
save('collect_stamp', svg(160, 160, `
  <circle cx="80" cy="80" r="74" fill="${INK}"/><circle cx="80" cy="80" r="68" fill="#4fd36a"/>
  <circle cx="80" cy="80" r="56" fill="none" stroke="#e8ffe8" stroke-width="5" stroke-dasharray="10 7"/>
  <path d="M50 82 L72 104 L112 58" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 82 L72 104 L112 58" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`));

// Game-over illustration: a sooty, dazed bomb under a little smoke cloud.
{
  const rng = mulberry32(41);
  save('gameover_bomb', svg(256, 256, `
    ${cloud([[92, 52, 22], [124, 40, 28], [158, 54, 22], [110, 62, 18], [142, 66, 18]], '#bdb3cc', '#ffffff')}
    <ellipse cx="128" cy="236" rx="70" ry="10" fill="#000000" opacity="0.25"/>
    <path d="M86 224 C80 212 96 206 108 210 C112 222 104 230 86 224 Z M170 224 C176 212 160 206 148 210 C144 222 152 230 170 224 Z" fill="#4a3b5c" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="128" cy="150" r="78" fill="${INK}"/>
    <defs><radialGradient id="soot" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="#9a8fae"/><stop offset="0.5" stop-color="#5b5070"/><stop offset="1" stop-color="#2a2238"/></radialGradient></defs>
    <circle cx="128" cy="150" r="72" fill="url(#soot)"/>
    <circle cx="96" cy="196" r="10" fill="#2a2238" opacity="0.6"/><circle cx="170" cy="120" r="8" fill="#2a2238" opacity="0.6"/>
    <ellipse cx="96" cy="104" rx="20" ry="10" fill="#ffffff" opacity="0.35" transform="rotate(-30 96 104)"/>
    <rect x="114" y="66" width="28" height="18" rx="4" fill="#8b93a8" stroke="${INK}" stroke-width="4"/>
    <path d="M128 66 C124 56 132 52 130 46" fill="none" stroke="#2a1a10" stroke-width="7" stroke-linecap="round"/>
    <path d="M90 128 L112 150 M112 128 L90 150 M144 128 L166 150 M166 128 L144 150" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    <path d="M102 184 Q116 172 128 184 Q140 196 154 184" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <rect x="150" y="160" width="34" height="14" rx="4" fill="#ffe0c4" stroke="${INK}" stroke-width="3" transform="rotate(-25 167 167)"/>
    ${[0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      return `<polygon points="${starPoints(128 + Math.cos(a) * 92, 92 + Math.sin(a) * 18, 5, 12, 5, rng())}" fill="#ffe14d" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    }).join('')}`));
}

// Favicon: a compact Ember bomb.
writeFileSync(join(root, 'public', 'favicon.svg'), bombSvg('ember', 'idle', 0));

writeFileSync(META_OUT, JSON.stringify({ fuseTips: FUSE_META }, null, 2) + '\n');
console.log(`Generated ${written} SVG assets in public/assets/svg and bomb metadata in src/assets/bombMeta.json`);
