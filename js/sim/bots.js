import { bus } from '../core/bus.js';
import { CONFIG } from '../config.js';
import { randomBetween, randomInt, pick } from './rng.js';

// UI-facing simulation events (consumed by bets lists / chat):
//   bets:reset            — new round, clear live list
//   bets:placed  {key, name, avatar, amount, isPlayer}
//   bets:cashout {key, mult, win}
//   bets:crashed          — round over, remaining live bets lost
//   chat:message {name, avatar, text, isPlayer}

const FIRST_NAMES = [
  'Sipho', 'Thabo', 'Lerato', 'Kagiso', 'Naledi', 'Bongani', 'Ayanda', 'Mandla',
  'Zanele', 'Tumelo', 'Karabo', 'Nomsa', 'David', 'Peter', 'Grace', 'Samuel',
  'Blessing', 'Emeka', 'Kwame', 'Amina', 'Musa', 'Fatima', 'John', 'Maria',
  'Ivan', 'Elena', 'Carlos', 'Lucia',
];

function maskName(name) {
  const keep = name.slice(0, 2);
  return `${keep}***${randomInt(10, 99)}`;
}

function makeRoster(count) {
  const roster = [];
  for (let i = 0; i < count; i += 1) {
    roster.push({
      id: `bot-${i}`,
      name: maskName(pick(FIRST_NAMES)),
      avatar: `assets/avatars/av${randomInt(1, 8)}.svg`,
    });
  }
  return roster;
}

const STAKES = [0.2, 0.5, 0.5, 1, 1, 1, 2, 2, 3, 5, 5, 8, 10, 15, 20, 50];

function sampleTarget() {
  const r = Math.random();
  if (r < 0.08) return Infinity; // rides until the crash
  if (r < 0.6) return randomBetween(1.1, 2);
  if (r < 0.88) return randomBetween(2, 5);
  if (r < 0.97) return randomBetween(5, 15);
  return randomBetween(15, 50);
}

const CHAT_LINES = [
  'lets gooo', 'that crash was brutal', 'anyone else riding to 10x?', 'gg',
  'cashed out just in time 😅', 'this bird is on fire', 'one more round',
  'so close...', 'never chasing 20x again', 'ez money', 'big one incoming, I can feel it',
  'nice win!', '2x and I am out', 'who else lost that one?', '⚡⚡⚡',
];

class Bots {
  constructor() {
    this.roster = makeRoster(26);
    this.liveBets = new Map();
    this.pendingTimers = [];
  }

  start() {
    bus.on('OnNewGameOpenBetting', () => this.onBettingOpen());
    bus.on('OnGameMultiplier', ({ value }) => this.onMultiplier(value));
    bus.on('OnGameCrash', () => this.onCrash());
    this.scheduleChat();
  }

  onBettingOpen() {
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];
    this.liveBets.clear();

    const count = randomInt(8, 16);
    const bots = [...this.roster].sort(() => Math.random() - 0.5).slice(0, count);
    const windowMs = CONFIG.countdownSeconds * 1000 * 0.9;

    bots.forEach((bot) => {
      const delay = randomBetween(100, windowMs);
      this.pendingTimers.push(setTimeout(() => {
        const bet = { bot, stake: pick(STAKES), target: sampleTarget(), cashed: false };
        this.liveBets.set(bot.id, bet);
        bus.emit('bets:placed', {
          key: bot.id,
          name: bot.name,
          avatar: bot.avatar,
          amount: bet.stake,
          isPlayer: false,
        });
      }, delay));
    });
  }

  onMultiplier(value) {
    this.liveBets.forEach((bet) => {
      if (!bet.cashed && value >= bet.target) {
        bet.cashed = true;
        // Cash out at the target (server would honour the requested multiplier)
        bus.emit('bets:cashout', {
          key: bet.bot.id,
          mult: bet.target,
          win: bet.stake * bet.target,
        });
      }
    });
  }

  onCrash() {
    bus.emit('bets:crashed');
  }

  scheduleChat() {
    const loop = () => {
      const bot = pick(this.roster);
      bus.emit('chat:message', {
        name: bot.name,
        avatar: bot.avatar,
        text: pick(CHAT_LINES),
        isPlayer: false,
      });
      setTimeout(loop, randomBetween(9000, 22000));
    };
    setTimeout(loop, randomBetween(2500, 6000));
  }
}

export const bots = new Bots();

// ---------------------------------------------------------------------------
// Top Bets seed data — regenerated per filter selection / refresh.
// type: 0 = Cashout Wins, 1 = Multiplier Wins, 2 = Multipliers
// period: 0 = Day, 1 = Month, 2 = Year
// ---------------------------------------------------------------------------
export function generateTopBets(type, period) {
  const scale = [1, 4, 20][period];
  const rows = [];
  const count = 10;
  for (let i = 0; i < count; i += 1) {
    const stake = pick(STAKES) * (1 + period);
    let mult;
    if (type === 0) mult = randomBetween(1.2, 8) * Math.sqrt(scale);
    else mult = randomBetween(8, 60) * Math.sqrt(scale);
    mult = Math.min(mult, CONFIG.maxMultiplier);
    rows.push({
      name: maskName(pick(FIRST_NAMES)),
      avatar: `assets/avatars/av${randomInt(1, 8)}.svg`,
      bet: stake,
      mult,
      win: stake * mult,
      round: randomInt(3200, 4200),
    });
  }
  const sortKey = { 0: 'win', 1: 'win', 2: 'mult' }[type];
  rows.sort((a, b) => b[sortKey] - a[sortKey]);
  return rows;
}
