// Starry-sky backdrop with subtle storm clouds: a vertical night gradient,
// a deterministic field of gently twinkling stars, and the three scrolling
// cloud strips from the final art drawn at low opacity, with occasional
// lightning flickers inside them.
//
// Stars and clouds live in the 1920x1080 design space so the composition
// holds under the cover fit. Cloud scroll speeds are taken from the Spine
// `bird_background` animation (design-space px over its 4s duration).
import { drawSlotWrapped, slotContentBox } from './assets.js';

const STAR_COUNT = 170;

// deterministic per-star hash -> [0, 1) so the field is stable across frames
function rand(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  x: rand(i, 1) * 1920,
  y: rand(i, 2) * 1080,
  // squared so most stars stay tiny with a handful of bright ones
  r: 1.0 + rand(i, 3) ** 2 * 2.4,
  base: 0.3 + rand(i, 4) * 0.55,
  speed: 0.4 + rand(i, 5) * 1.3,
  phase: rand(i, 6) * Math.PI * 2,
}));

// top / middle / bottom gradient stops
const NIGHT_SKY = ['#03050e', '#0a1026', '#161d3f'];

// [slot, startX, px/s] — from the bird_background bone translate timelines.
const CLOUD_LAYERS = [
  ['top_cloud2', -1392.17, -28.96],
  ['top_cloud3', -1826.33, -25.9],
  ['top_cloud1', -27.72, -49.28],
];
const CLOUD_ALPHA = 0.4;
const FLICKER_ALPHA = 0.3;

// Lightning flickers live inside a cloud strip and scroll with it.
// Blink pattern mirrors the Spine timelines: short double/triple blinks.
const FLICKERS = [
  { slot: 'top_cloud1_lightning3', cloud: 'top_cloud1' },
  { slot: 'top_cloud1_lightning4', cloud: 'top_cloud1' },
  { slot: 'top_cloud2_lightning1', cloud: 'top_cloud2' },
  { slot: 'top_cloud2_lightning2', cloud: 'top_cloud2' },
].map((f) => ({ ...f, nextAt: 2 + Math.random() * 4, blinks: [] }));

function cloudScroll(slotName, time) {
  const layer = CLOUD_LAYERS.find(([slot]) => slot === slotName);
  return layer[1] + layer[2] * time;
}

function drawFlicker(ctx, view, f, time, scroll = time) {
  if (time >= f.nextAt) {
    // schedule a burst of 2-3 blinks, ~66ms on / ~66ms off
    const count = 2 + (Math.random() < 0.4 ? 1 : 0);
    f.blinks = [];
    let t = time;
    for (let i = 0; i < count; i += 1) {
      f.blinks.push([t, t + 0.066]);
      t += 0.133;
    }
    f.nextAt = time + 2.5 + Math.random() * 5;
  }
  const on = f.blinks.some(([a, b]) => time >= a && time < b);
  if (!on) return;
  // tile in lock-step with the parent cloud so the flicker stays on its puff
  // (blink timing follows real time; position follows the — possibly frozen — scroll)
  drawSlotWrapped(ctx, view, f.slot, cloudScroll(f.cloud, scroll), slotContentBox(f.cloud));
}

// Full backdrop: everything behind the curve and the bird.
// `calm` (reduce-distractions) freezes the cloud scroll and holds the stars
// at a steady brightness instead of twinkling.
export function drawBackground(ctx, view, w, h, time, calm = false) {
  const scroll = calm ? 0 : time;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, NIGHT_SKY[0]);
  sky.addColorStop(0.55, NIGHT_SKY[1]);
  sky.addColorStop(1, NIGHT_SKY[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (const s of STARS) {
    const twinkle = calm ? 0.8 : 0.6 + 0.4 * Math.sin(time * s.speed + s.phase);
    ctx.globalAlpha = Math.min(1, s.base * twinkle);
    const x = view.x + s.x * view.s;
    const y = view.y + s.y * view.s;
    const r = Math.max(0.5, s.r * view.s);
    // soft halo on the brightest stars only — keeps the pass cheap
    ctx.shadowBlur = s.r > 2.6 ? r * 4 : 0;
    ctx.shadowColor = '#cfe0ff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // subtle storm clouds over the stars (draw order per the Spine skeleton:
  // 2, 3, then 1 on top), each followed by its own lightning flickers
  ctx.save();
  for (const [slot] of CLOUD_LAYERS) {
    ctx.globalAlpha = CLOUD_ALPHA;
    drawSlotWrapped(ctx, view, slot, cloudScroll(slot, scroll));
    ctx.globalAlpha = FLICKER_ALPHA;
    for (const f of FLICKERS) {
      if (f.cloud === slot) drawFlicker(ctx, view, f, time, scroll);
    }
  }
  ctx.restore();
}
