import { CONFIG } from '../config.js';
import { bus } from '../core/bus.js';
import { fmtMult, mulRange } from '../core/format.js';
import { openDialog } from './dialogs.js';

// Multiplier history strip in the header (production lib-history):
// newest chip first, capped at CONFIG.historyLimit, expandable dropdown,
// chip click opens round info (provably-fair affordance).
export function initHistory() {
  const strip = document.getElementById('history-strip');
  const expand = document.getElementById('history-expand');
  const toggle = document.getElementById('history-toggle');

  const entries = [];
  let currentHash = '';

  bus.on('OnNewGameOpenBetting', ({ hash }) => {
    currentHash = hash;
  });

  function chipEl({ value, roundId, hash }) {
    const chip = document.createElement('div');
    chip.className = `history-chip range-${mulRange(value)}`;
    chip.textContent = fmtMult(value);
    chip.addEventListener('click', () => {
      openDialog({
        title: 'Round result',
        bodyHTML: `
          <div class="setting-row"><span>Round</span><span class="dialog-strong">#${roundId}</span></div>
          <div class="setting-row"><span>Result</span><span class="dialog-strong">${fmtMult(value)}</span></div>
          <div class="setting-row"><span>Game hash</span>
            <span class="dialog-strong" style="font-size:11px;word-break:break-all">${hash}</span></div>
          <p style="margin-top:12px">Round result is determined from a combination of the server seed
          and the first bets of the round (provably fair).</p>`,
        buttons: [{ label: 'Close', primary: true }],
      });
    });
    return chip;
  }

  function renderExpand() {
    expand.innerHTML = '';
    entries.forEach((entry) => expand.appendChild(chipEl(entry)));
  }

  bus.on('OnRoundCompleted', ({ multiplier, roundId }) => {
    const entry = { value: multiplier, roundId, hash: currentHash };
    entries.unshift(entry);
    if (entries.length > CONFIG.historyLimit) entries.pop();

    strip.prepend(chipEl(entry));
    while (strip.children.length > CONFIG.historyLimit) strip.lastChild.remove();
    if (!expand.hidden) renderExpand();
  });

  toggle.addEventListener('click', () => {
    expand.hidden = !expand.hidden;
    if (!expand.hidden) renderExpand();
  });

  document.addEventListener('click', (e) => {
    if (!expand.hidden && !expand.contains(e.target) && e.target !== toggle) expand.hidden = true;
  });
}
