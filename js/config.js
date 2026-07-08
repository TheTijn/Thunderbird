// Central game configuration. In production these values arrive from the
// server initComplete payload; here they are the single tuning point.
export const CONFIG = {
  gameName: 'thunderbird',
  currency: '€',
  startingBalance: 1000,

  // Round timing (production: countDownDurationMS / 1000, default 5s)
  countdownSeconds: 5,
  lockPauseMs: 400,        // beat between bets-locked and launch
  takeoffMs: 900,          // bird sweep-in transition
  crashHoldMs: 1300,       // crash frame hold (multiplier stays neon green)
  resultHoldMs: 2600,      // red result frame hold
  multiplierTickMs: 150,   // simulated server multiplier feed rate

  // Multiplier curve: m(t) = e^(growthRate * seconds) → 2x ≈ 6s, 10x ≈ 19s
  growthRate: 0.12,
  houseEdge: 0.03,
  maxMultiplier: 500,
  instantBustChance: 0.01,

  // Stakes (production: betLimits)
  minStake: 0.1,
  maxStake: 100,
  stakeStep: 0.1,
  defaultStake: 1,
  denominations: [0.1, 0.5, 1, 2, 3, 5],

  // Auto features (production: game.config.autoCashout / autoPlay)
  autoCashout: { enabled: true, default: 1.4, min: 1.01 },
  autoPlay: { enabled: true, rounds: [3, 5, 10, 20] },

  chatMessageLimit: 200,
  historyLimit: 50,

  waitingText: 'WAITING FOR NEXT ROUND',
};
