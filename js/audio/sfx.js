import { bus } from '../core/bus.js';

// All sound is synthesized with WebAudio — no audio assets. Muted by default
// until the player opts in (sound-consent pattern, as in production).
const STORAGE_KEY = 'tb-muted';

class SFX {
  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    this.muted = stored === null ? true : stored === 'true';
    this.ctx = null;
    this.noiseBuffer = null;
    this.pad = null;
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(STORAGE_KEY, String(muted));
    if (muted) this.stopPad();
    bus.emit('sfx:muteChange', muted);
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone({ type = 'sine', from = 440, to = from, time = 0.15, gain = 0.08, delay = 0 }) {
    const ctx = this.ensure();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + time);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + time);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + time + 0.02);
  }

  noise({ time = 0.4, gain = 0.1, filterFrom = 800, filterTo = filterFrom, type = 'lowpass', delay = 0 }) {
    const ctx = this.ensure();
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), t0 + time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + time);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + time + 0.05);
  }

  play(name) {
    if (this.muted) return;
    try {
      switch (name) {
        case 'click':
          this.tone({ type: 'square', from: 720, to: 600, time: 0.05, gain: 0.035 });
          break;
        case 'error':
          this.tone({ type: 'sawtooth', from: 240, to: 140, time: 0.18, gain: 0.05 });
          break;
        case 'cashout':
          this.tone({ from: 880, to: 880, time: 0.1, gain: 0.07 });
          this.tone({ from: 1318, to: 1318, time: 0.14, gain: 0.07, delay: 0.09 });
          this.tone({ from: 1760, to: 1760, time: 0.22, gain: 0.06, delay: 0.18 });
          break;
        case 'takeoff':
          this.noise({ time: 0.6, gain: 0.06, filterFrom: 300, filterTo: 3200, type: 'bandpass' });
          this.tone({ type: 'triangle', from: 220, to: 620, time: 0.5, gain: 0.045 });
          break;
        case 'crash':
          this.noise({ time: 0.9, gain: 0.16, filterFrom: 5000, filterTo: 120 });
          this.tone({ type: 'sine', from: 90, to: 36, time: 0.8, gain: 0.16 });
          this.tone({ type: 'square', from: 2400, to: 900, time: 0.08, gain: 0.05 });
          break;
        case 'result':
          this.noise({ time: 0.5, gain: 0.04, filterFrom: 1200, filterTo: 300 });
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn('[sfx]', err);
    }
  }

  // Low ambient pad during flight, pitch rises gently with the multiplier.
  startPad() {
    if (this.muted || this.pad) return;
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 82;
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 0.7);
    osc.connect(filter).connect(g).connect(ctx.destination);
    osc.start();
    this.pad = { osc, g, filter };
  }

  updatePad(multiplier) {
    if (!this.pad) return;
    this.pad.osc.frequency.value = 82 * Math.min(4, multiplier ** 0.28);
  }

  stopPad() {
    if (!this.pad) return;
    const { osc, g } = this.pad;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.stop(t + 0.2);
    this.pad = null;
  }
}

export const sfx = new SFX();

export function wireGameSounds() {
  bus.on('OnGameLaunch', () => {
    sfx.play('takeoff');
    sfx.startPad();
  });
  bus.on('OnGameMultiplier', ({ value }) => sfx.updatePad(value));
  bus.on('OnGameCrash', () => {
    sfx.stopPad();
    sfx.play('crash');
  });
  bus.on('OnRoundCompleted', () => sfx.play('result'));
}
