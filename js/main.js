import { bus } from './core/bus.js';
import { CONFIG } from './config.js';
import { gameServer } from './sim/gameServer.js';
import { bots } from './sim/bots.js';
import { scene } from './canvas/scene.js';
import { initHeader } from './ui/header.js';
import { initHistory } from './ui/history.js';
import { initMultiplierOverlay } from './ui/multiplierOverlay.js';
import { initBetsPanel } from './ui/betsPanel.js';
import { initChat } from './ui/chat.js';
import { initViewerControls } from './ui/viewerControls.js';
import { createBetPanel } from './ui/betPanel.js';
import { sfx, wireGameSounds } from './audio/sfx.js';
import { openDialog } from './ui/dialogs.js';

const SOUND_CONSENT_KEY = 'tb-sound-consent';

function animateLoadingBird() {
  const fillWrap = document.querySelector('#loading-bird .bird-fill-wrap');
  let progress = 0;
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      progress = Math.min(100, progress + 4 + Math.random() * 6);
      fillWrap.style.setProperty('--fill', `${progress}%`);
      if (progress >= 100) {
        clearInterval(timer);
        resolve();
      }
    }, 90);
  });
}

function askSoundConsent() {
  if (localStorage.getItem(SOUND_CONSENT_KEY)) return;
  openDialog({
    title: 'Sound',
    bodyHTML: '<p>Do you want to play with sound?</p>',
    buttons: [
      {
        label: 'Yes',
        primary: true,
        onClick: () => {
          localStorage.setItem(SOUND_CONSENT_KEY, 'yes');
          sfx.setMuted(false);
        },
      },
      {
        label: 'No',
        onClick: () => {
          localStorage.setItem(SOUND_CONSENT_KEY, 'no');
          sfx.setMuted(true);
        },
      },
    ],
  });
}

async function boot() {
  const loadingScreen = document.getElementById('loading-screen');
  const app = document.getElementById('app');
  const viewer = document.getElementById('viewer');
  const canvas = document.getElementById('game-canvas');

  const header = initHeader();
  initHistory();
  initMultiplierOverlay();
  initBetsPanel();
  initChat(header.getAvatar);

  const betPanelsHost = document.getElementById('bet-panels');
  createBetPanel(0, betPanelsHost, header.getAvatar);
  createBetPanel(1, betPanelsHost, header.getAvatar);

  wireGameSounds();

  // App must be visible (display != none) before the canvas can size itself.
  app.hidden = false;
  await Promise.all([scene.init(canvas, viewer), animateLoadingBird()]);

  // scene is initialised (its calm:change listener is live) — now sync the
  // in-viewer controls so the initial preference reaches the scene.
  initViewerControls();

  loadingScreen.classList.add('fade-out');
  setTimeout(() => loadingScreen.remove(), 600);

  bots.start();
  gameServer.start();

  askSoundConsent();
}

boot().catch((err) => console.error('[thunderbird] boot failed', err));

// Debug/QA handle (also handy for operators embedding the game)
window.__thunderbird = { bus, gameServer, CONFIG };
