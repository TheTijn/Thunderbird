import { CONFIG } from '../config.js';
import { bus } from './bus.js';
import { roundMoney } from './format.js';

let balance = CONFIG.startingBalance;

export const wallet = {
  get() {
    return balance;
  },

  canAfford(amount) {
    return amount <= balance;
  },

  debit(amount) {
    if (!wallet.canAfford(amount)) return false;
    balance = roundMoney(balance - amount);
    bus.emit('wallet:change', balance);
    return true;
  },

  credit(amount) {
    balance = roundMoney(balance + amount);
    bus.emit('wallet:change', balance);
  },
};
