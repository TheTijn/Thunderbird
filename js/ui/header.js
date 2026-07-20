import { bus } from '../core/bus.js';
import { wallet } from '../core/wallet.js';
import { fmtMoney } from '../core/format.js';
import { openDialog } from './dialogs.js';
import { sfx } from '../audio/sfx.js';

const HOW_TO_PLAY_HTML = `
  <p><span class="dialog-strong">Thunderbird</span> is a crash betting game. A multiplier starts at
  1.00x and climbs continuously — cash out before the bird gets struck!</p>
  <p><span class="dialog-strong">1.</span> Place a bet (or two at the same time) before the round starts.</p>
  <p><span class="dialog-strong">2.</span> Watch the multiplier climb as the Thunderbird flies.</p>
  <p><span class="dialog-strong">3.</span> Cash out before the crash and win your stake &times; the multiplier.
  Wait too long and the bet is lost.</p>
  <p>Use <span class="dialog-strong">AUTO CASH OUT</span> to bank automatically at a target multiplier,
  and <span class="dialog-strong">AUTO BET</span> to re-place your stake every round.</p>`;

export function initHeader() {
  const balanceEl = document.getElementById('balance-value');
  const muteBtn = document.getElementById('mute-btn');
  const avatarEl = document.getElementById('player-avatar');

  const renderBalance = (value) => {
    balanceEl.textContent = fmtMoney(value);
  };
  renderBalance(wallet.get());
  bus.on('wallet:change', renderBalance);

  // mute toggle
  const renderMute = () => muteBtn.classList.toggle('muted', sfx.isMuted());
  renderMute();
  muteBtn.addEventListener('click', () => {
    sfx.setMuted(!sfx.isMuted());
    renderMute();
  });
  bus.on('sfx:muteChange', renderMute);

  // avatar cycles through the local set
  let avatarIndex = 1;
  avatarEl.addEventListener('click', () => {
    avatarIndex = (avatarIndex % 8) + 1;
    avatarEl.src = `assets/avatars/av${avatarIndex}.svg`;
    bus.emit('player:avatar', avatarEl.src);
  });

  document.getElementById('help-btn').addEventListener('click', () => {
    openDialog({
      title: 'Thunderbird — How to play',
      bodyHTML: HOW_TO_PLAY_HTML,
      buttons: [{ label: 'Got it', primary: true }],
    });
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    const box = openDialog({
      title: 'Settings',
      bodyHTML: `
        <div class="setting-row">
          <span>Sound effects</span>
          <div class="switch ${sfx.isMuted() ? '' : 'on'}" id="setting-sound"></div>
        </div>
        <div class="setting-row">
          <span>Game</span><span class="dialog-strong">Thunderbird Crash</span>
        </div>`,
      buttons: [{ label: 'Close', primary: true }],
    });
    box.querySelector('#setting-sound').addEventListener('click', (e) => {
      sfx.setMuted(!sfx.isMuted());
      e.currentTarget.classList.toggle('on', !sfx.isMuted());
    });
  });

  document.getElementById('home-btn').addEventListener('click', () => {
    openDialog({
      title: 'Lobby',
      bodyHTML: '<p>This standalone build has no lobby — in production this returns to the operator page.</p>',
      buttons: [{ label: 'Close', primary: true }],
    });
  });

  return { getAvatar: () => avatarEl.src };
}
