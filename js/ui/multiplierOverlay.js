import { CONFIG } from '../config.js';
import { bus } from '../core/bus.js';
import { fmtMult, fmtMoney } from '../core/format.js';
import { gameServer, GameState } from '../sim/gameServer.js';
import { multiplierAtTime } from '../sim/rng.js';

// DOM overlay over the canvas: waiting state (headline + bird fill),
// the big multiplier badge, and the cashout toast.
export function initMultiplierOverlay() {
  const waiting = document.getElementById('waiting-overlay');
  const waitingBird = document.getElementById('waiting-bird');
  const fillWrap = waitingBird.querySelector('.bird-fill-wrap');
  const badge = document.getElementById('multiplier-badge');
  const badgeText = document.getElementById('multiplier-text');
  const toasts = document.getElementById('win-toasts');
  // One live card per bet market (keyed) so two quick cashouts sit side by side
  // instead of one clobbering the other.
  const cards = new Map();

  bus.on('OnNewGameOpenBetting', () => {
    waiting.hidden = false;
    badge.hidden = true;
    badge.className = 'multiplier-badge';
    fillWrap.style.setProperty('--fill', '0%');
  });

  bus.on('OnGameCountDown', ({ progress }) => {
    fillWrap.style.setProperty('--fill', `${Math.round(progress * 100)}%`);
  });

  bus.on('OnGameLaunch', () => {
    waiting.hidden = true;
    badge.hidden = false;
    badge.className = 'multiplier-badge';
    badgeText.textContent = '1.00x';
  });

  bus.on('OnGameCrash', ({ multiplier }) => {
    badge.classList.add('crash');
    badgeText.textContent = fmtMult(multiplier);
  });

  bus.on('OnRoundCompleted', () => {
    badge.classList.remove('crash');
    badge.classList.add('result');
  });

  // Smooth 60fps counter during flight (production interpolates server ticks;
  // our sim shares the growth formula so we can evaluate it directly).
  function tick() {
    if (gameServer.state === GameState.Live) {
      const value = Math.min(multiplierAtTime(gameServer.elapsedSeconds()), gameServer.crashPoint);
      badgeText.textContent = fmtMult(value);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  bus.on('player:cashout', ({ key, mult, win }) => {
    // Reuse the card for this market if it's still on screen (e.g. same market
    // cashing out again), otherwise spawn a fresh one next to any existing card.
    const cardKey = key ?? `anon-${cards.size}`;
    let entry = cards.get(cardKey);
    if (!entry) {
      const el = document.createElement('div');
      el.className = 'win-toast';
      toasts.appendChild(el);
      entry = { el, timer: 0 };
      cards.set(cardKey, entry);
    }
    const { el } = entry;
    el.classList.remove('fade-out');
    el.innerHTML = `
      <span class="toast-label">You cashed out</span>
      <span class="toast-amount">${fmtMoney(0)}</span>
      <span class="toast-mult">${fmtMult(mult)}</span>`;

    // count the win up from zero — the little jackpot moment
    const amountEl = el.querySelector('.toast-amount');
    const t0 = performance.now();
    const duration = 700;
    (function countUp(now) {
      if (!el.isConnected) return;
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      amountEl.textContent = fmtMoney(win * eased);
      if (p < 1) requestAnimationFrame(countUp);
    })(t0);

    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => {
        el.remove();
        cards.delete(cardKey);
      }, 300); // matches .win-toast.fade-out transition
    }, 3200);
  });

  // Clear any lingering cards when a new round opens.
  bus.on('OnNewGameOpenBetting', () => {
    for (const [, entry] of cards) {
      clearTimeout(entry.timer);
      entry.el.remove();
    }
    cards.clear();
  });
}
