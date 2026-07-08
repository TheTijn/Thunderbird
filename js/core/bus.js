// Tiny event bus — stands in for the production SignalR hub connection.
// Game events use the same names as the production wire protocol:
// OnNewGameOpenBetting, OnGameCountDown, OnGameCountDownLock, OnGameLaunch,
// OnGameMultiplier, OnGameCrash, OnRoundCompleted.
const listeners = new Map();

export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => bus.off(event, fn);
  },

  off(event, fn) {
    listeners.get(event)?.delete(fn);
  },

  emit(event, payload) {
    listeners.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] listener error for "${event}"`, err);
      }
    });
  },
};
