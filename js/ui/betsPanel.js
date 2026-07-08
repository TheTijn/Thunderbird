import { bus } from '../core/bus.js';
import { fmtMoney, fmtMult, mulRange } from '../core/format.js';
import { generateTopBets } from '../sim/bots.js';
import { sfx } from '../audio/sfx.js';

// Left panel: ALL BETS / MY BETS / TOP BETS (production lib-all-bets /
// lib-my-bets / lib-top-bets structure).
export function initBetsPanel() {
  const root = document.getElementById('bets-panel');
  root.innerHTML = `
    <div class="panel-tabs">
      <button class="panel-tab active" data-tab="all">
        <span class="tab-icon" style="--icon:url('assets/svg/icon-bets.svg')"></span>All Bets
      </button>
      <button class="panel-tab" data-tab="my">
        <span class="tab-icon" style="--icon:url('assets/svg/icon-user.svg')"></span>My Bets
      </button>
      <button class="panel-tab" data-tab="top">
        <span class="tab-icon" style="--icon:url('assets/svg/icon-trend.svg')"></span>Top Bets
      </button>
    </div>

    <div class="panel-content" data-content="all">
      <div class="allbets-header"><h2>All Bets:</h2><h3 id="allbets-count">0</h3></div>
      <div class="bets-legend"><span>User</span><span>Bet</span><span>Cashout</span></div>
      <div class="bets-list scroll" id="allbets-list"></div>
    </div>

    <div class="panel-content" data-content="my" hidden>
      <div class="bets-list scroll" id="mybets-list">
        <div class="mybets-empty">No bets yet this session.<br>Place a bet to see it here.</div>
      </div>
    </div>

    <div class="panel-content" data-content="top" hidden>
      <div class="topbets-filters">
        <div class="btn-toggle" id="topbets-type">
          <span class="active">Cashout Wins</span><span>Multiplier Wins</span><span>Multipliers</span>
        </div>
        <div class="btn-toggle" id="topbets-period">
          <span class="active">Day</span><span>Month</span><span>Year</span>
        </div>
        <button class="refresh-btn" id="topbets-refresh" aria-label="Refresh"></button>
      </div>
      <div class="bets-list scroll" id="topbets-list"></div>
    </div>`;

  // ---------- tabs ----------
  const tabs = root.querySelectorAll('.panel-tab');
  const contents = root.querySelectorAll('.panel-content');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      contents.forEach((c) => {
        c.hidden = c.dataset.content !== tab.dataset.tab;
      });
      sfx.play('click');
    });
  });

  // ---------- ALL BETS ----------
  const list = document.getElementById('allbets-list');
  const countEl = document.getElementById('allbets-count');
  const rows = new Map();

  // Clear on the round event itself (not a relayed reset) so this listener —
  // registered before the bet panels — runs first, and queued player bets
  // re-emitted at betting open are not wiped.
  bus.on('OnNewGameOpenBetting', () => {
    rows.clear();
    list.innerHTML = '';
    countEl.textContent = '0';
  });

  bus.on('bets:placed', ({ key, name, avatar, amount, isPlayer }) => {
    const row = document.createElement('div');
    row.className = 'bet-row';
    row.innerHTML = `
      <div class="bet-user"><img src="${avatar}" alt=""><span>${name}</span></div>
      <div class="bet-amount">${fmtMoney(amount)}</div>
      <div class="bet-cashout">–</div>`;
    if (isPlayer) {
      row.style.outline = '1px solid var(--tb-primary-dim)';
      list.prepend(row);
    } else {
      list.appendChild(row);
    }
    rows.set(key, row);
    countEl.textContent = String(rows.size);
  });

  bus.on('bets:cancelled', ({ key }) => {
    rows.get(key)?.remove();
    if (rows.delete(key)) countEl.textContent = String(rows.size);
  });

  bus.on('bets:cashout', ({ key, mult, win }) => {
    const row = rows.get(key);
    if (!row) return;
    row.classList.add('cashed');
    row.querySelector('.bet-cashout').innerHTML =
      `<span class="mult-chip">${fmtMult(mult)}</span><div>${fmtMoney(win)}</div>`;
  });

  bus.on('bets:crashed', () => {
    rows.forEach((row) => {
      if (!row.classList.contains('cashed')) {
        row.classList.add('lost');
        row.querySelector('.bet-cashout').textContent = '✕';
      }
    });
  });

  // ---------- MY BETS ----------
  const myList = document.getElementById('mybets-list');
  let myEmpty = true;

  bus.on('mybets:add', ({ stake, mult, win }) => {
    if (myEmpty) {
      myList.innerHTML = '';
      myEmpty = false;
    }
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const row = document.createElement('div');
    row.className = `mybet-row ${win > 0 ? 'win' : 'loss'}`;
    row.innerHTML = `
      <span class="mybet-time">${time}</span>
      <span>${fmtMoney(stake)}${mult ? ` <span class="mult-chip">${fmtMult(mult)}</span>` : ''}</span>
      <span class="mybet-win">${win > 0 ? fmtMoney(win) : '—'}</span>`;
    myList.prepend(row);
    while (myList.children.length > 30) myList.lastChild.remove();
  });

  // ---------- TOP BETS ----------
  const topList = document.getElementById('topbets-list');
  const typeToggle = document.getElementById('topbets-type');
  const periodToggle = document.getElementById('topbets-period');
  const refreshBtn = document.getElementById('topbets-refresh');
  let topType = 0;
  let topPeriod = 0;

  function renderTop() {
    topList.innerHTML = '';
    generateTopBets(topType, topPeriod).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'topbet-row';
      row.innerHTML = `
        <div class="profile-col"><img src="${entry.avatar}" alt=""><span>${entry.name}</span></div>
        <div class="topbet-details">
          <div class="detail-line"><span class="k">Bet:</span><span class="v">${fmtMoney(entry.bet)}</span></div>
          <div class="detail-line"><span class="k">Cashout:</span><span class="v mult-chip">${fmtMult(entry.mult)}</span></div>
          <div class="detail-line"><span class="k">Win:</span><span class="v">${fmtMoney(entry.win)}</span></div>
        </div>
        <div class="topbet-icons">
          <span class="row-icon" style="--icon:url('assets/svg/icon-chat.svg')" title="Share to chat"></span>
          <span class="row-icon" style="--icon:url('assets/svg/icon-shield.svg')" title="Verify round #${entry.round}"></span>
        </div>`;
      topList.appendChild(row);
    });
  }

  function bindToggle(el, onChange) {
    el.querySelectorAll('span').forEach((option, i) => {
      option.addEventListener('click', () => {
        el.querySelectorAll('span').forEach((o) => o.classList.toggle('active', o === option));
        onChange(i);
        sfx.play('click');
      });
    });
  }

  bindToggle(typeToggle, (i) => {
    topType = i;
    renderTop();
  });
  bindToggle(periodToggle, (i) => {
    topPeriod = i;
    renderTop();
  });

  refreshBtn.addEventListener('click', () => {
    refreshBtn.classList.remove('spinning');
    void refreshBtn.offsetWidth; // restart the spin animation
    refreshBtn.classList.add('spinning');
    renderTop();
    sfx.play('click');
  });

  renderTop();
}
