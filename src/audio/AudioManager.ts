import type { CategoryId } from '../config/categories';
import { CATEGORIES } from '../config/categories';

type Wave = OscillatorType;

interface ToneOpts {
  type?: Wave;
  gain?: number;
  at?: number;
  attack?: number;
  slideTo?: number;
  vibrato?: number;
  filter?: number;
}

interface NoiseOpts {
  gain?: number;
  at?: number;
  type?: BiquadFilterType;
  freq?: number;
  sweepTo?: number;
  q?: number;
}

/**
 * All sound effects are synthesized at runtime with the Web Audio API
 * (oscillators, envelopes, filtered noise). No audio files are used.
 * The context is created lazily on the first user gesture, and every call
 * fails silently if audio is unavailable.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();
  private volume = 0.7;
  private muted = false;
  private failed = false;

  get isMuted(): boolean { return this.muted; }
  get currentVolume(): number { return this.volume; }

  configure(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    this.applyGain();
  }

  /** Must be called from a user gesture handler (browser autoplay policy). */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) { this.failed = true; return; }
        this.ctx = new Ctor();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        this.master = this.ctx.createGain();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 1.0);
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.applyGain();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.failed = true;
      this.ctx = null;
    }
  }

  private applyGain(): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.85, this.ctx.currentTime, 0.02);
    }
  }

  /** Returns the audio clock if a sound may play now (respects mute and per-sound throttles). */
  private begin(name: string, minGapMs = 0): number | null {
    if (!this.ctx || !this.master || this.muted || this.volume <= 0 || this.ctx.state !== 'running') return null;
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? -Infinity;
    if (now - last < minGapMs) return null;
    this.lastPlayed.set(name, now);
    return this.ctx.currentTime;
  }

  private tone(freq: number, dur: number, o: ToneOpts = {}): void {
    const ctx = this.ctx!, t = (o.at ?? ctx.currentTime);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t + dur);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = o.vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const peak = o.gain ?? 0.2;
    const attack = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.filter;
      osc.connect(lp);
      node = lp;
    }
    node.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, o: NoiseOpts = {}): void {
    const ctx = this.ctx!, t = o.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filt = ctx.createBiquadFilter();
    filt.type = o.type ?? 'lowpass';
    filt.frequency.setValueAtTime(o.freq ?? 2000, t);
    if (o.sweepTo) filt.frequency.exponentialRampToValueAtTime(o.sweepTo, t + dur);
    filt.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private notes(freqs: number[], step: number, dur: number, o: ToneOpts = {}): void {
    const t = this.ctx!.currentTime;
    freqs.forEach((f, i) => this.tone(f, dur, { ...o, at: (o.at ?? t) + i * step }));
  }

  // ------------------------------------------------------------ cues

  uiSelect(): void {
    if (this.begin('ui', 40) === null) return;
    this.notes([660, 990], 0.05, 0.08, { type: 'square', gain: 0.07, filter: 3500 });
  }

  gameStart(): void {
    const t = this.begin('start', 300);
    if (t === null) return;
    this.noise(0.35, { type: 'bandpass', freq: 400, sweepTo: 3000, gain: 0.12, q: 1.5 });
    this.notes([523.25, 659.25, 783.99, 1046.5], 0.08, 0.18, { type: 'triangle', gain: 0.16, at: t + 0.05 });
  }

  spawn(): void {
    if (this.begin('spawn', 70) === null) return;
    this.noise(0.14, { type: 'bandpass', freq: 1500, sweepTo: 350, gain: 0.16, q: 2 });
    this.tone(330, 0.1, { slideTo: 170, gain: 0.12 });
  }

  doorOpen(): void {
    const t = this.begin('door', 300);
    if (t === null) return;
    this.noise(0.25, { freq: 600, sweepTo: 150, gain: 0.25 });
    this.tone(110, 0.3, { type: 'square', slideTo: 70, gain: 0.08, filter: 600 });
    this.notes([392, 523.25], 0.12, 0.2, { type: 'triangle', gain: 0.12, at: t + 0.2 });
  }

  pickup(): void {
    if (this.begin('pickup', 50) === null) return;
    this.tone(380, 0.08, { slideTo: 720, gain: 0.1 });
  }

  drop(): void {
    if (this.begin('drop', 50) === null) return;
    this.tone(520, 0.09, { slideTo: 280, gain: 0.08 });
  }

  sort(category: CategoryId, combo = 0): void {
    const t = this.begin('sort', 30);
    if (t === null) return;
    const root = CATEGORIES[category].chimeHz * Math.pow(2, Math.min(combo, 6) / 24);
    this.tone(root, 0.3, { type: 'triangle', gain: 0.16, at: t });
    this.tone(root * 1.5, 0.35, { type: 'triangle', gain: 0.13, at: t + 0.055 });
    this.tone(root * 3, 0.25, { type: 'sine', gain: 0.05, at: t + 0.055 });
  }

  bonus(): void {
    const t = this.begin('bonus', 100);
    if (t === null) return;
    this.notes([1318.5, 1568, 2093], 0.05, 0.16, { type: 'square', gain: 0.05, filter: 5000, at: t + 0.12 });
  }

  wrong(): void {
    if (this.begin('wrong', 200) === null) return;
    this.tone(160, 0.28, { type: 'sawtooth', gain: 0.14, filter: 900 });
    this.tone(152, 0.28, { type: 'sawtooth', gain: 0.12, filter: 900 });
  }

  fuseWarning(): void {
    if (this.begin('warn', 400) === null) return;
    this.tone(620, 0.12, { type: 'triangle', slideTo: 940, gain: 0.07 });
  }

  fuseTick(urgency: number): void {
    if (this.begin('tick', 160) === null) return;
    this.tone(1400 + urgency * 900, 0.035, { type: 'square', gain: 0.035 + urgency * 0.03, filter: 4000 });
  }

  explosion(): void {
    const t = this.begin('explode', 80);
    if (t === null) return;
    this.tone(170, 0.45, { slideTo: 38, gain: 0.55, attack: 0.003 });
    this.noise(0.55, { freq: 2400, sweepTo: 180, gain: 0.4 });
    for (let i = 0; i < 4; i++) {
      this.noise(0.05, { type: 'highpass', freq: 3000, gain: 0.07, at: t + 0.06 + i * 0.05 + Math.random() * 0.03 });
    }
  }

  chainPop(index: number): void {
    const t = this.begin('chain', 55);
    if (t === null) return;
    const base = 240 + Math.min(index, 20) * 14;
    this.tone(base, 0.14, { slideTo: 70, gain: 0.2 });
    this.noise(0.1, { type: 'bandpass', freq: 900 + Math.random() * 600, gain: 0.12, q: 1.2 });
  }

  collect(): void {
    const t = this.begin('collect', 200);
    if (t === null) return;
    for (let i = 0; i < 5; i++) this.noise(0.03, { type: 'bandpass', freq: 1200 + i * 450, gain: 0.12, q: 4, at: t + i * 0.045 });
    this.notes([783.99, 987.77, 1174.66, 1567.98], 0.07, 0.22, { type: 'triangle', gain: 0.14, at: t + 0.24 });
    this.tone(2093, 0.4, { type: 'sine', gain: 0.05, at: t + 0.52 });
  }

  levelUp(): void {
    const t = this.begin('level', 300);
    if (t === null) return;
    this.notes([523.25, 659.25, 783.99], 0.07, 0.14, { type: 'triangle', gain: 0.13, at: t });
    this.tone(1046.5, 0.35, { type: 'triangle', gain: 0.14, at: t + 0.21 });
  }

  gameOver(): void {
    const t = this.begin('over', 1000);
    if (t === null) return;
    [392, 369.99, 349.23].forEach((f, i) => this.tone(f, 0.3, { type: 'sawtooth', gain: 0.09, filter: 1400, at: t + i * 0.32 }));
    this.tone(329.63, 0.95, { type: 'sawtooth', gain: 0.1, filter: 1200, vibrato: 7, at: t + 0.96 });
  }

  highScore(): void {
    const t = this.begin('best', 1000);
    if (t === null) return;
    this.notes([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.08, 0.2, { type: 'square', gain: 0.06, filter: 4000, at: t });
    [1046.5, 1318.5, 1567.98].forEach((f) => this.tone(f, 0.6, { type: 'triangle', gain: 0.08, at: t + 0.42 }));
  }
}

export const audio = new AudioManager();
