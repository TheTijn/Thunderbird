import { CONFIG } from '../config.js';
import { bus } from '../core/bus.js';
import { gameServer } from '../sim/gameServer.js';
import { readSceneTheme } from './theme.js';
import { drawRipples, drawSilhouettes } from './background.js';
import { computeCurvePoints, drawCurve, headAngle, plotArea } from './curve.js';
import { drawDial } from './dial.js';
import { ParticleSystem } from './particles.js';
import { loadSprites, drawSprite } from './bird.js';

// Canvas scene — renders the six visual states of the round on a single
// 2D canvas sitting inside the .viewer. The DOM handles the waiting text,
// multiplier badge and toasts; the canvas handles the world.
class Scene {
  constructor() {
    this.mode = 'loading';
    this.particles = new ParticleSystem();
    this.launchAt = 0;
    this.crashAt = 0;
    this.crashElapsed = 0;
    this.crashHead = null;
    this.bolt = [];
    this.boltSeedAt = 0;
    this.lastFrame = 0;
  }

  async init(canvas, viewer) {
    this.canvas = canvas;
    this.viewer = viewer;
    this.ctx = canvas.getContext('2d');
    this.theme = readSceneTheme();
    await loadSprites();

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
    bus.on('OnRoundCompleted', () => this.setMode('result'));

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
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (this.mode === 'takeoff' || this.mode === 'live' || this.mode === 'crash') {
      this.renderFlight(now, dt, w, h);
    } else if (this.mode === 'result') {
      this.renderResult(now, w, h);
    }
    // betting/locked/loading: CSS gradient + DOM overlay only
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

    // crash shake
    ctx.save();
    if (isCrash) {
      const shakeT = (now - this.crashAt) / 260;
      if (shakeT < 1) {
        const amp = (1 - shakeT) * h * 0.014;
        ctx.translate((Math.random() - 0.5) * amp * 2, (Math.random() - 0.5) * amp * 2);
      }
    }

    drawRipples(ctx, w, h, this.theme.ripple, elapsed);
    drawSilhouettes(ctx, w, h, this.theme.silhouette, this.theme.silhouetteWindow);
    drawDial(ctx, w, h, this.theme, fadeIn);

    const points = computeCurvePoints(elapsed, w, h);
    drawCurve(ctx, points, this.theme, w, h);

    const head = isCrash && this.crashHead ? this.crashHead : points[points.length - 1];
    const angle = headAngle(points);
    const birdWidth = Math.max(46, w * 0.085);

    if (isCrash) {
      this.renderCrashFx(now, w, h, head);
      drawSprite(ctx, 'skeleton', head.x, head.y - birdWidth * 0.3, {
        angle: angle * 0.4,
        width: birdWidth,
      });
    } else {
      // bird eases in from the lower-left during take-off
      const start = { x: -birdWidth, y: plotArea(w, h).bottom - h * 0.05 };
      const ease = 1 - (1 - takeoffP) ** 3;
      const bx = start.x + (head.x - start.x) * ease;
      const by = start.y + (head.y - start.y) * ease;
      const bob = Math.sin(elapsed * 4.5) * 0.05;

      this.particles.trail(bx - birdWidth * 0.35, by + birdWidth * 0.12, angle, h / 450);
      drawSprite(ctx, 'flying', bx, by - birdWidth * 0.3, {
        angle: angle * 0.5 + bob,
        width: birdWidth,
        glow: this.theme.curve,
      });
    }

    this.particles.update(dt);
    this.particles.draw(ctx, this.theme.curve);
    ctx.restore();
  }

  renderCrashFx(now, w, h, head) {
    const { ctx } = this;
    const t = (now - this.crashAt) / 1000;

    // lightning bolt from the sky to the bird, re-jittered every 70ms
    if (t < 0.5) {
      if (now - this.boltSeedAt > 70) {
        this.boltSeedAt = now;
        const segments = 6;
        const startX = Math.min(w - 10, head.x + w * 0.16);
        this.bolt = [];
        for (let i = 0; i <= segments; i += 1) {
          const p = i / segments;
          this.bolt.push({
            x: startX + (head.x - startX) * p + (i === 0 || i === segments ? 0 : (Math.random() - 0.5) * w * 0.03),
            y: -10 + (head.y + 10) * p,
          });
        }
      }
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.theme.curve;
      ctx.shadowColor = this.theme.curve;
      ctx.shadowBlur = 22;
      ctx.globalAlpha = 0.9 * (1 - t * 2);
      ctx.lineWidth = Math.max(3, h * 0.012);
      ctx.beginPath();
      this.bolt.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }

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
    const { ctx } = this;
    drawRipples(ctx, w, h, this.theme.resultRipple, now / 1000);

    const cx = w * 0.5;
    const cy = h * 0.58;
    const chickenW = Math.min(w * 0.34, h * 0.62);

    // soft glow behind the chicken
    const glow = ctx.createRadialGradient(cx, cy, chickenW * 0.1, cx, cy, chickenW * 0.85);
    glow.addColorStop(0, 'rgba(0,0,0,0.34)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, chickenW * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // faint ring arc, per the result mock-up
    ctx.save();
    ctx.strokeStyle = 'rgba(255,120,100,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.05, h * 0.42, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
    ctx.restore();

    drawSprite(ctx, 'chicken', cx, cy, { width: chickenW });
  }
}

export const scene = new Scene();
