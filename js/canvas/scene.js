import { CONFIG } from '../config.js';
import { bus } from '../core/bus.js';
import { gameServer } from '../sim/gameServer.js';
import { multiplierAtTime } from '../sim/rng.js';
import { readSceneTheme } from './theme.js';
import { loadArt, coverView } from './assets.js';
import { drawBackground } from './background.js';
import { computeCurvePoints, drawCurve, headAngle, plotArea } from './curve.js';
import { drawDial } from './dial.js';
import { ParticleSystem } from './particles.js';
import {
  BIRD_SCALE,
  drawFlyingBird,
  flyingBirdTailPoint,
  drawElectrocutedBird,
  drawLightningBolt,
  drawEndscreen,
} from './bird.js';

// Canvas scene — renders the six visual states of the round on a single
// 2D canvas sitting inside the .viewer. The DOM handles the waiting text,
// multiplier badge and toasts; the canvas handles the world.
class Scene {
  constructor() {
    this.mode = 'loading';
    this.particles = new ParticleSystem();
    this.launchAt = 0;
    this.crashAt = 0;
    this.resultAt = 0;
    this.crashElapsed = 0;
    this.crashHead = null;
    this.bgTime = 0;
    this.lastFrame = 0;
  }

  async init(canvas, viewer) {
    this.canvas = canvas;
    this.viewer = viewer;
    this.ctx = canvas.getContext('2d');
    this.theme = readSceneTheme();
    await loadArt();

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = viewer.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      this.dpr = dpr;
    };
    fit();
    new ResizeObserver(fit).observe(viewer);

    bus.on('OnNewGameOpenBetting', () => {
      this.particles.clear();
      this.crashHead = null;
      this.setMode('betting');
    });
    bus.on('OnGameCountDownLock', () => this.setMode('locked'));
    bus.on('OnGameLaunch', () => {
      this.launchAt = performance.now();
      this.setMode('takeoff');
    });
    bus.on('OnGameCrash', () => {
      this.crashAt = performance.now();
      this.crashElapsed = gameServer.elapsedSeconds();
      this.setMode('crash');
      const { w, h } = this.size();
      const pts = computeCurvePoints(this.crashElapsed, w, h);
      this.crashHead = pts[pts.length - 1];
      this.particles.burst(this.crashHead.x, this.crashHead.y, 60, h / 450);
    });
    bus.on('OnRoundCompleted', () => {
      this.resultAt = performance.now();
      this.setMode('result');
    });

    requestAnimationFrame((t) => this.frame(t));
  }

  setMode(mode) {
    this.mode = mode;
    this.viewer.dataset.state = mode === 'locked' ? 'betting' : mode;
  }

  size() {
    return { w: this.canvas.width / this.dpr, h: this.canvas.height / this.dpr };
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000 || 0.016);
    this.lastFrame = now;
    this.render(now, dt);
    requestAnimationFrame((t) => this.frame(t));
  }

  render(now, dt) {
    const { ctx } = this;
    const { w, h } = this.size();
    this.bgTime += dt; // scenery keeps drifting in every state
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (this.mode === 'result') {
      this.renderResult(now, w, h);
    } else if (this.mode === 'takeoff' || this.mode === 'live' || this.mode === 'crash') {
      this.renderFlight(now, dt, w, h);
    } else if (this.mode === 'betting' || this.mode === 'locked') {
      // scenery behind the DOM waiting overlay
      drawBackground(ctx, coverView(w, h), w, h, this.bgTime);
    }
    // loading: DOM loading screen covers the canvas
  }

  renderFlight(now, dt, w, h) {
    const { ctx } = this;
    const isCrash = this.mode === 'crash';
    const sinceLaunch = now - this.launchAt;

    // takeoff → live is purely visual
    if (this.mode === 'takeoff' && sinceLaunch >= CONFIG.takeoffMs) this.setMode('live');

    const elapsed = isCrash ? this.crashElapsed : gameServer.elapsedSeconds();
    const takeoffP = Math.min(1, sinceLaunch / CONFIG.takeoffMs);
    const fadeIn = isCrash ? 1 : takeoffP;
    const view = coverView(w, h);

    // crash shake
    ctx.save();
    if (isCrash) {
      const shakeT = (now - this.crashAt) / 260;
      if (shakeT < 1) {
        const amp = (1 - shakeT) * h * 0.014;
        ctx.translate((Math.random() - 0.5) * amp * 2, (Math.random() - 0.5) * amp * 2);
      }
    }

    // live multiplier drives the dial rotation; during crash it holds at the
    // crash point (elapsed is frozen at crashElapsed).
    const mult = isCrash
      ? Math.min(multiplierAtTime(elapsed), gameServer.crashPoint)
      : multiplierAtTime(elapsed);

    drawBackground(ctx, view, w, h, this.bgTime);
    drawDial(ctx, w, h, this.theme, fadeIn, mult);

    const points = computeCurvePoints(elapsed, w, h);
    drawCurve(ctx, points, this.theme, w, h);

    const head = isCrash && this.crashHead ? this.crashHead : points[points.length - 1];
    const angle = headAngle(points);
    // px per authored design unit; keeps the bird at the mock-up proportion
    // but caps it so it never dwarfs a small canvas
    const birdScale = Math.min(view.s, w / 1920) * BIRD_SCALE;
    const birdWidth = 543 * birdScale;

    // bird position + fresh trail sparks are computed first, but everything
    // is drawn after the particles so the bird sits on top of its own trail.
    let bx = 0;
    let by = 0;
    if (!isCrash) {
      // bird eases in from the lower-left during take-off
      const start = { x: -birdWidth, y: plotArea(w, h).bottom - h * 0.05 };
      const ease = 1 - (1 - takeoffP) ** 3;
      bx = start.x + (head.x - start.x) * ease;
      by = start.y + (head.y - start.y) * ease;

      const tail = flyingBirdTailPoint(bx, by, birdScale, elapsed, angle * 0.5);
      this.particles.trail(tail.x, tail.y, angle, h / 450);
    }

    // particles render behind the bird / crash actors
    this.particles.update(dt);
    this.particles.draw(ctx, this.theme.curve);

    if (isCrash) {
      const t = (now - this.crashAt) / 1000;
      this.renderCrashFlash(now, w, h);
      drawLightningBolt(ctx, head.x, head.y, birdScale / BIRD_SCALE, t);
      drawElectrocutedBird(ctx, head.x, head.y, birdScale, view.s, t);
    } else {
      drawFlyingBird(ctx, bx, by, birdScale, elapsed, angle * 0.5);
    }
    ctx.restore();
  }

  renderCrashFlash(now, w, h) {
    const { ctx } = this;
    const t = (now - this.crashAt) / 1000;
    // brief flash right at impact — keep subtle so the frame stays readable
    if (t < 0.22) {
      ctx.save();
      ctx.globalAlpha = (1 - t / 0.22) * 0.13;
      ctx.fillStyle = this.theme.curve;
      ctx.fillRect(-20, -20, w + 40, h + 40);
      ctx.restore();
    }
  }

  renderResult(now, w, h) {
    const view = coverView(w, h);
    drawEndscreen(this.ctx, view, (now - this.resultAt) / 1000);
  }
}

export const scene = new Scene();
