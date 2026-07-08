import { CONFIG } from '../config.js';
import { bus } from '../core/bus.js';
import { sampleCrashPoint, multiplierAtTime, fakeHash } from './rng.js';

// Client-facing game states (visual). The wire events below follow the
// production SignalR protocol names.
export const GameState = {
  Loading: 'loading',
  Betting: 'betting',
  Locked: 'locked',
  Takeoff: 'takeoff',
  Live: 'live',
  Crash: 'crash',
  Result: 'result',
};

class GameServer {
  constructor() {
    this.state = GameState.Loading;
    this.roundId = 4180;
    this.crashPoint = 1;
    this.multiplier = 1;
    this.launchTime = 0;
    this.hash = '';
    this.timers = new Set();
  }

  after(ms, fn) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  every(ms, fn) {
    const id = setInterval(fn, ms);
    this.timers.add(id);
    return id;
  }

  clear(id) {
    clearTimeout(id);
    clearInterval(id);
    this.timers.delete(id);
  }

  start() {
    this.openBetting();
  }

  openBetting() {
    this.state = GameState.Betting;
    this.roundId += 1;
    this.hash = fakeHash();
    this.multiplier = 1;
    bus.emit('OnNewGameOpenBetting', {
      roundId: this.roundId,
      hash: this.hash,
      seconds: CONFIG.countdownSeconds,
    });

    const total = CONFIG.countdownSeconds * 1000;
    const start = performance.now();
    const tick = this.every(100, () => {
      const remaining = Math.max(0, total - (performance.now() - start));
      bus.emit('OnGameCountDown', { remainingMs: remaining, progress: 1 - remaining / total });
      if (remaining <= 0) {
        this.clear(tick);
        this.state = GameState.Locked;
        bus.emit('OnGameCountDownLock', { roundId: this.roundId });
        this.after(CONFIG.lockPauseMs, () => this.launch());
      }
    });
  }

  launch() {
    this.crashPoint = sampleCrashPoint();
    this.launchTime = performance.now();
    this.state = GameState.Live;
    bus.emit('OnGameLaunch', { roundId: this.roundId });

    const tick = this.every(CONFIG.multiplierTickMs, () => {
      const m = Math.min(multiplierAtTime(this.elapsedSeconds()), this.crashPoint);
      this.multiplier = m;
      bus.emit('OnGameMultiplier', { value: m });
      if (m >= this.crashPoint) {
        this.clear(tick);
        this.crash();
      }
    });
  }

  crash() {
    this.state = GameState.Crash;
    this.multiplier = this.crashPoint;
    bus.emit('OnGameCrash', { multiplier: this.crashPoint, roundId: this.roundId });

    this.after(CONFIG.crashHoldMs, () => {
      this.state = GameState.Result;
      bus.emit('OnRoundCompleted', { multiplier: this.crashPoint, roundId: this.roundId });
      this.after(CONFIG.resultHoldMs, () => this.openBetting());
    });
  }

  elapsedSeconds() {
    return (performance.now() - this.launchTime) / 1000;
  }
}

export const gameServer = new GameServer();
