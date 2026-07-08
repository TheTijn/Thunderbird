import { CONFIG } from '../config.js';
import { bus } from '../core/bus.js';
import { wallet } from '../core/wallet.js';
import { fmtMoney, fmtMult, clamp, roundMoney } from '../core/format.js';
import { gameServer, GameState } from '../sim/gameServer.js';
import { sfx } from '../audio/sfx.js';

// Bet statuses (production enum Re)
const Status = {
  Available: 'BET_AVAILABLE',
  Queued: 'BET_QUEUED',     // placed outside the betting window → next round
  Placed: 'BET_PLACED',     // active bet for the current round
  CashedOut: 'CASHED_OUT',
};

export function createBetPanel(index, container, getAvatar) {
  const el = document.createElement('div');
  el.className = 'bet-panel';
  el.innerHTML = `
    <div class="toprow">
      <div class="btn-toggle mode-toggle">
        <span class="active" data-mode="bet">BET</span><span data-mode="auto">AUTO</span>
      </div>
      <div class="auto-group auto-bet disabled">
        <span>AUTO BET</span>
        <div class="switch" data-role="autobet"></div>
      </div>
      <div class="auto-group auto-cash disabled">
        <span>AUTO CASH OUT</span>
        <div class="switch" data-role="autocash"></div>
        <input class="autocash-input" value="${CONFIG.autoCashout.default.toFixed(2)}"
               inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" aria-label="CashOut" disabled>
      </div>
    </div>
    <div class="mainrow">
      <div class="stake-control">
        <div class="stepper">
          <button class="minus-btn" aria-label="Decrease stake"></button>
          <input class="value-input" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*"
                 value="${CONFIG.defaultStake.toFixed(2)}">
          <button class="plus-btn" aria-label="Increase stake"></button>
        </div>
        <div class="denominations">
          ${CONFIG.denominations.map((d, i) => `<button class="denomination" data-i="${i}" data-v="${d}">${d}</button>`).join('')}
        </div>
      </div>
      <button class="main-bet">
        <span class="autoplay-rounds" hidden></span>
        <h2>BET</h2>
        <h1>${fmtMoney(CONFIG.defaultStake)}</h1>
      </button>
    </div>`;
  container.appendChild(el);

  const refs = {
    modeTabs: el.querySelectorAll('.mode-toggle span'),
    autoBetGroup: el.querySelector('.auto-bet'),
    autoCashGroup: el.querySelector('.auto-cash'),
    autoBetSwitch: el.querySelector('[data-role="autobet"]'),
    autoCashSwitch: el.querySelector('[data-role="autocash"]'),
    autoCashInput: el.querySelector('.autocash-input'),
    minus: el.querySelector('.minus-btn'),
    plus: el.querySelector('.plus-btn'),
    stakeInput: el.querySelector('.value-input'),
    denominations: el.querySelectorAll('.denomination'),
    button: el.querySelector('.main-bet'),
    label: el.querySelector('.main-bet h2'),
    amount: el.querySelector('.main-bet h1'),
  };

  const state = {
    stake: CONFIG.defaultStake,
    status: Status.Available,
    mode: 'bet',
    autoBet: false,
    autoCash: false,
    autoCashTarget: CONFIG.autoCashout.default,
    lastDenomIndex: -1,
    liveValue: 1,
  };

  const key = () => `player-${index}`;

  // ---------- rendering ----------

  function render() {
    const gs = gameServer.state;
    const inCountdown = gs === GameState.Betting;
    const locked = gs === GameState.Locked;
    const live = gs === GameState.Live || gs === GameState.Takeoff;

    el.classList.remove('status-cancel', 'status-cashout');
    refs.button.disabled = false;

    if (state.status === Status.Placed && live) {
      el.classList.add('status-cashout');
      refs.label.textContent = 'CASH OUT';
      refs.amount.textContent = fmtMoney(roundMoney(state.stake * state.liveValue));
    } else if (state.status === Status.Placed && (inCountdown || locked)) {
      el.classList.add('status-cancel');
      refs.label.textContent = 'CANCEL';
      refs.amount.textContent = fmtMoney(state.stake);
      if (locked) refs.button.disabled = true; // bets are locked, launch imminent
    } else if (state.status === Status.Queued) {
      el.classList.add('status-cancel');
      refs.label.textContent = 'CANCEL';
      refs.amount.textContent = fmtMoney(state.stake);
    } else if (state.status === Status.CashedOut) {
      refs.label.textContent = 'BET';
      refs.amount.textContent = fmtMoney(state.stake);
    } else {
      refs.label.textContent = 'BET';
      refs.amount.textContent = fmtMoney(state.stake);
    }

    // stake editing only while no money is committed
    const editable = state.status === Status.Available || state.status === Status.CashedOut;
    refs.stakeInput.disabled = !editable;
    refs.minus.setAttribute('aria-disabled', String(!editable || state.stake <= CONFIG.minStake));
    refs.plus.setAttribute('aria-disabled', String(!editable || state.stake >= CONFIG.maxStake));
    refs.denominations.forEach((btn) => {
      btn.disabled = !editable;
    });

    refs.autoBetGroup.classList.toggle('disabled', state.mode !== 'auto');
    refs.autoCashGroup.classList.toggle('disabled', state.mode !== 'auto');
    refs.autoBetSwitch.classList.toggle('on', state.autoBet);
    refs.autoCashSwitch.classList.toggle('on', state.autoCash);
    refs.autoCashInput.disabled = !(state.mode === 'auto' && state.autoCash && editable);
  }

  function setStake(value) {
    state.stake = roundMoney(clamp(value, CONFIG.minStake, CONFIG.maxStake));
    refs.stakeInput.value = state.stake.toFixed(2);
    render();
  }

  // ---------- bet lifecycle ----------

  function emitPlaced() {
    bus.emit('bets:placed', {
      key: key(),
      name: 'You',
      avatar: getAvatar(),
      amount: state.stake,
      isPlayer: true,
    });
  }

  function place(queued) {
    if (!wallet.debit(state.stake)) {
      sfx.play('error');
      refs.button.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
        { duration: 220 },
      );
      return;
    }
    state.status = queued ? Status.Queued : Status.Placed;
    if (!queued) emitPlaced();
    sfx.play('click');
    render();
  }

  function cancel() {
    wallet.credit(state.stake);
    bus.emit('bets:cancelled', { key: key() });
    state.status = Status.Available;
    sfx.play('click');
    render();
  }

  function cashout(mult) {
    const win = roundMoney(state.stake * mult);
    wallet.credit(win);
    state.status = Status.CashedOut;
    bus.emit('bets:cashout', { key: key(), mult, win });
    bus.emit('player:cashout', { key: key(), mult, win });
    bus.emit('mybets:add', { stake: state.stake, mult, win });
    sfx.play('cashout');
    render();
  }

  refs.button.addEventListener('click', () => {
    const gs = gameServer.state;
    if (state.status === Status.Available || state.status === Status.CashedOut) {
      if (gs === GameState.Betting) place(false);
      else place(true); // queue for next round
    } else if (state.status === Status.Queued) {
      cancel();
    } else if (state.status === Status.Placed) {
      if (gs === GameState.Betting) cancel();
      else if (gs === GameState.Live || gs === GameState.Takeoff) {
        cashout(Math.min(gameServer.multiplier, gameServer.crashPoint));
      }
    }
  });

  // ---------- game events ----------

  bus.on('OnNewGameOpenBetting', () => {
    state.liveValue = 1;
    if (state.status === Status.Queued) {
      state.status = Status.Placed;
      emitPlaced();
    } else if (state.status === Status.CashedOut) {
      state.status = Status.Available;
    } else if (state.status === Status.Available && state.mode === 'auto' && state.autoBet) {
      if (wallet.debit(state.stake)) {
        state.status = Status.Placed;
        emitPlaced();
      } else {
        state.autoBet = false; // ran out of funds — stop autoplay
      }
    }
    render();
  });

  bus.on('OnGameCountDownLock', render);
  bus.on('OnGameLaunch', render);

  bus.on('OnGameMultiplier', ({ value }) => {
    if (state.status !== Status.Placed) return;
    state.liveValue = value;
    if (state.mode === 'auto' && state.autoCash && value >= state.autoCashTarget) {
      cashout(state.autoCashTarget);
      return;
    }
    render();
  });

  bus.on('OnGameCrash', () => {
    if (state.status === Status.Placed) {
      bus.emit('mybets:add', { stake: state.stake, mult: null, win: 0 });
      state.status = Status.Available;
    }
    render();
  });

  // ---------- controls ----------

  refs.modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      state.mode = tab.dataset.mode;
      refs.modeTabs.forEach((t) => t.classList.toggle('active', t === tab));
      sfx.play('click');
      render();
    });
  });

  refs.autoBetSwitch.addEventListener('click', () => {
    state.autoBet = !state.autoBet;
    sfx.play('click');
    render();
  });

  refs.autoCashSwitch.addEventListener('click', () => {
    state.autoCash = !state.autoCash;
    sfx.play('click');
    render();
  });

  refs.autoCashInput.addEventListener('change', () => {
    const parsed = parseFloat(refs.autoCashInput.value.replace(',', '.'));
    const target = Number.isFinite(parsed)
      ? Math.max(CONFIG.autoCashout.min, Math.round(parsed * 100) / 100)
      : CONFIG.autoCashout.default;
    state.autoCashTarget = target;
    refs.autoCashInput.value = target.toFixed(2);
  });

  refs.minus.addEventListener('click', () => setStake(state.stake - CONFIG.stakeStep));
  refs.plus.addEventListener('click', () => setStake(state.stake + CONFIG.stakeStep));

  refs.stakeInput.addEventListener('change', () => {
    const parsed = parseFloat(refs.stakeInput.value.replace(',', '.'));
    setStake(Number.isFinite(parsed) ? parsed : CONFIG.defaultStake);
  });

  // chip behaviour (production): different chip sets the stake,
  // tapping the same chip again adds to it.
  refs.denominations.forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      const v = Number(btn.dataset.v);
      setStake(i === state.lastDenomIndex ? state.stake + v : v);
      state.lastDenomIndex = i;
      sfx.play('click');
    });
  });

  render();
  return el;
}
