import { bus } from '../core/bus.js';

// In-viewer controls overlaid on the game canvas.
//
// Calm toggle ("reduce motion & distractions"): holds the starry sky at a
// steady brightness instead of twinkling. The scene owns the
// rendering; this just tracks the preference and emits `calm:change`. Default
// follows the OS `prefers-reduced-motion` until the user makes a choice, which
// is then remembered in localStorage.
const CALM_KEY = 'tb-calm';

function readCalmPref() {
  try {
    const stored = localStorage.getItem(CALM_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

export function initViewerControls() {
  const calmBtn = document.getElementById('calm-btn');

  const apply = (on) => {
    calmBtn.classList.toggle('active', on);
    calmBtn.setAttribute('aria-pressed', String(on));
    bus.emit('calm:change', on);
  };

  // sync the scene + button to the initial preference
  apply(readCalmPref());

  calmBtn.addEventListener('click', () => {
    const next = calmBtn.getAttribute('aria-pressed') !== 'true';
    try {
      localStorage.setItem(CALM_KEY, next ? '1' : '0');
    } catch (e) { /* private mode — no persistence */ }
    apply(next);
  });
}
