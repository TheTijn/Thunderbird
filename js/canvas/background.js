// Layered scenery from the final art: gradient backdrop, glowing city
// skyline, two scrolling tree lines and three scrolling cloud strips with
// occasional lightning flickers inside the clouds.
//
// Scroll speeds are taken from the Spine `bird_background` animation
// (design-space px over its 4s duration); the strips wrap at their own width.
import { drawSlot, drawSlotWrapped, slotContentBox } from './assets.js';

// [slot, startX, px/s] — from the bird_background bone translate timelines.
const CLOUD_LAYERS = [
  ['top_cloud2', -1392.17, -28.96],
  ['top_cloud3', -1826.33, -25.9],
  ['top_cloud1', -27.72, -49.28],
];
const TREE_BACK = { start: 0, speed: -50.15 };
const TREE_FRONT = { start: 0, speed: -221.62 };

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

function drawFlicker(ctx, view, f, time) {
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
  drawSlotWrapped(ctx, view, f.slot, cloudScroll(f.cloud, time), slotContentBox(f.cloud));
}

// Full backdrop: everything behind the curve and the bird.
export function drawBackground(ctx, view, w, h, time) {
  // gradient backdrop (cover)
  drawSlot(ctx, view, 'background');

  // city skyline glow sits behind the tree lines
  drawSlot(ctx, view, 'city_skyline');

  // tree lines
  drawSlotWrapped(ctx, view, 'tree_line_back', TREE_BACK.start + TREE_BACK.speed * time);
  drawSlotWrapped(ctx, view, 'tree_line_front', TREE_FRONT.start + TREE_FRONT.speed * time);

  // cloud strips (draw order per the Spine skeleton: 2, 3, then 1 on top),
  // each followed by its own lightning flickers
  for (const [slot] of CLOUD_LAYERS) {
    drawSlotWrapped(ctx, view, slot, cloudScroll(slot, time));
    for (const f of FLICKERS) {
      if (f.cloud === slot) drawFlicker(ctx, view, f, time);
    }
  }
}
