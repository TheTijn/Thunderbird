# Thunderbird Crash Game

Standalone web build of the **Thunderbird** crash game theme (April 2026 creative brief),
structurally mirroring the production Rodeo crash game layout so it can travel as a theme.

## Run

The site ships with a Node.js server (`server.js`) so it can run on Node hosts
such as Hostinger. ES modules require http, not `file://`.

```bash
npm install
npm start
# → http://localhost:3000  (or the PORT the host provides)
```

Any static file server also works for a quick look, e.g. `python3 -m http.server 4173`.

## Deploy to Hostinger (Node.js hosting)

1. Upload the project (or connect the git repo) to your Hostinger account.
2. In hPanel open **Advanced → Node.js** and create an application:
   - **Application root**: the folder holding `package.json`
   - **Application startup file**: `server.js`
   - **Node.js version**: 18 or newer
3. Run **NPM Install** (installs Express), then **Start** the application.

Hostinger runs the app behind Passenger and injects the port via `process.env.PORT`,
which `server.js` reads automatically — no port needs to be hard-coded.

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
- **Assets** — final production art in `assets/img/`, sliced from the delivered Spine
  export (`art-src/thunderbird_FINAL.*`) by `node scripts/extract-atlas.mjs`. The script
  un-premultiplies the atlas pages, composes the 9 bird flight frames, converts the
  loading mask to a CSS alpha mask, and writes `assets/img/manifest.json` with each
  sprite's 1920x1080 design-space placement (computed from the Spine setup pose).
  Animation timings in `js/canvas/` mirror the Spine animations (`bird_flying`,
  `bird_background`, `bird_electrocuted`, `bird_lightning_bolt`, `bird_endscreen`).
  UI icons and the logo remain SVG in `assets/svg/`.
- **Audio** — all SFX synthesized with WebAudio (`js/audio/sfx.js`); muted until the player
  opts in, toggle in the header.

## Game states (per brief)

Loading → Betting (`WAITING FOR NEXT ROUND`, bird fills as countdown) → Take-off →
Live climb (glowing curve, bird at the leading edge, dial behind the multiplier) →
Crash (skeleton bird + lightning) → Result (red wash + roast chicken), then loops.

## Tuning

Everything lives in `js/config.js`: countdown seconds, stake limits, quick chips,
growth rate, house edge, hold times, chat limit.
