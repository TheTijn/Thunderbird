import { CONFIG } from '../config.js';

export function fmtMoney(value, symbol = CONFIG.currency) {
  return symbol + value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtMult(value) {
  return value.toFixed(2) + 'x';
}

// Multiplier range for history-chip colouring (production mulRange pipe).
export function mulRange(value) {
  if (value < 1.5) return 1;
  if (value < 2) return 2;
  if (value < 5) return 3;
  return 4;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Round stake values to cents to avoid float drift from repeated stepping.
export function roundMoney(value) {
  return Math.round(value * 100) / 100;
}
