import { CONFIG } from '../config.js';

// Crash point distribution used by most crash games:
// P(crash >= x) ≈ (1 - houseEdge) / x, floored at 1.00, capped.
export function sampleCrashPoint() {
  if (Math.random() < CONFIG.instantBustChance) return 1.0;
  const u = Math.max(Math.random(), 1e-9);
  const raw = (1 - CONFIG.houseEdge) / u;
  const value = Math.floor(raw * 100) / 100;
  return Math.min(CONFIG.maxMultiplier, Math.max(1.0, value));
}

// m(t) with t in seconds since launch.
export function multiplierAtTime(seconds) {
  return Math.exp(CONFIG.growthRate * seconds);
}

// Inverse: seconds needed to reach multiplier m.
export function timeToMultiplier(m) {
  return Math.log(m) / CONFIG.growthRate;
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

export function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Fake provably-fair style round hash for the round-info dialog.
export function fakeHash(length = 32) {
  let out = '';
  const hex = '0123456789abcdef';
  for (let i = 0; i < length; i += 1) out += hex[Math.floor(Math.random() * 16)];
  return out;
}
