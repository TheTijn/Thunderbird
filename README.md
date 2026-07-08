# Thunderbird Crash Game

Standalone web build of the **Thunderbird** crash game theme (April 2026 creative brief),
structurally mirroring the production Rodeo crash game layout so it can travel as a theme.

## Run

Any static file server works (ES modules require http, not `file://`):

```bash
python3 -m http.server 4173
# → http://localhost:4173
```

## What's inside

- **No build step, no dependencies** — vanilla ES modules + Canvas 2D.
- **Simulated backend** — `js/sim/gameServer.js` emits the same event names as the
  production SignalR feed (`OnNewGameOpenBetting`, `OnGameCountDown`, `OnGameCountDownLock`,
  `OnGameLaunch`, `OnGameMultiplier`, `OnGameCrash`, `OnRoundCompleted`). Crash points follow
  the standard `P(crash ≥ x) ≈ (1 − edge)/x` distribution; the multiplier grows as `e^(0.12t)`.
- **Full environment** — bot players in All Bets / Top Bets, bot chat, multiplier history,
  local €1,000 balance, two independent bet panels with auto bet & auto cash out.
- **Theme mechanism** — all colors live in `css/thunderbird.css` behind the
  `<link id="game-theme">` swap pattern used in production. The canvas reads its palette
  from the same CSS variables (`--tb-scene-*`).
- **Assets** — original flat SVG art in `assets/svg/` (bird, skeleton bird, roast chicken,
  logo, icons). Swap files in place to drop in final Luma art; no code changes needed.
- **Audio** — all SFX synthesized with WebAudio (`js/audio/sfx.js`); muted until the player
  opts in, toggle in the header.

## Game states (per brief)

Loading → Betting (`WAITING FOR NEXT ROUND`, bird fills as countdown) → Take-off →
Live climb (glowing curve, bird at the leading edge, dial behind the multiplier) →
Crash (skeleton bird + lightning) → Result (red wash + roast chicken), then loops.

## Tuning

Everything lives in `js/config.js`: countdown seconds, stake limits, quick chips,
growth rate, house edge, hold times, chat limit.
