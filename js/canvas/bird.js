// Bird states from the final art. The 9 flight frames are pre-composited by
// scripts/extract-atlas.mjs; timings below mirror the Spine animations
// (bird_flying, bird_electrocuted, bird_lightning_bolt).
import { art } from './assets.js';

// bird_flying attachment keys: frame i is visible from FLAP_KEYS[i] to
// FLAP_KEYS[i+1]; the cycle loops at 0.6s.
const FLAP_KEYS = [0, 0.1, 0.2, 0.2667, 0.3333, 0.4, 0.4667, 0.5333, 0.6];
const FLAP_CYCLE = 0.6;

// The Spine scene shows the bird at 0.75 of its authored size.
export const BIRD_SCALE = 0.75;
export const BIRD_BOX = 885; // authored design box of every bird sprite

function lerp(a, b, p) {
  return a + (b - a) * Math.min(1, Math.max(0, p));
}

// -------------------------------------------------------------------- flying
// bird_flying also bobs the whole bird: y 0 -> +13.95 (up) -> 0 over the cycle
function flapBob(cycle) {
  return cycle < 0.4333
    ? lerp(0, 13.95, cycle / 0.4333)
    : lerp(13.95, 0, (cycle - 0.4333) / (FLAP_CYCLE - 0.4333));
}

// (x, y) is the bird anchor (centre of the authored 885 box) in canvas px;
// sc is canvas px per authored design unit (view.s * BIRD_SCALE).
export function drawFlyingBird(ctx, x, y, sc, t, angle = 0) {
  const bf = art.manifest.birdFrames;
  const cycle = t % FLAP_CYCLE;
  let frame = 0;
  for (let i = 0; i < FLAP_KEYS.length - 1; i += 1) {
    if (cycle >= FLAP_KEYS[i]) frame = i;
  }
  const img = art.frames[frame];
  if (!img) return;

  const bob = flapBob(cycle);
  const w = bf.w * sc;
  const h = bf.h * sc;
  ctx.save();
  ctx.translate(x, y - bob * sc);
  ctx.rotate(angle);
  // the frame crop is off-centre inside the authored box
  ctx.drawImage(img, bf.cropX * sc, bf.cropY * sc, w, h);
  ctx.restore();
}

// --------------------------------------------------------------- crash state
// bird_electrocuted: holds at the crash point (static glow flickering), then
// tips over and drops off screen. t is seconds since the crash.
const STATIC_WINDOWS = [[0, 0.1333], [0.1667, 0.2667], [0.3333, 0.5333]];

export function drawElectrocutedBird(ctx, x, y, sc, vs, t) {
  if (t >= 1.2) return;

  // fall path from the ROOT_bird_electrocuted timelines (canvas px, +y down;
  // design-space distances, so scaled by the scene scale vs, not the bird's)
  let dy = 0;
  if (t >= 0.9) dy = lerp(-79.35, 644.58, (t - 0.9) / 0.3);
  else if (t >= 0.7333) dy = lerp(0, -79.35, (t - 0.7333) / 0.1667);
  const rot = t >= 0.8 ? lerp(0, -24, (t - 0.8) / 0.1667) : 0;

  ctx.save();
  ctx.translate(x, y + dy * vs);
  ctx.rotate((rot * Math.PI) / 180);
  drawBirdBoxSprite(ctx, 'bird_electrocuted', sc);
  if (STATIC_WINDOWS.some(([a, b]) => t >= a && t < b)) {
    drawBirdBoxSprite(ctx, 'bird_static', sc);
  }
  ctx.restore();
}

// draws one of the 885-box bird sprites centred on the current origin
function drawBirdBoxSprite(ctx, name, sc) {
  const r = art.manifest.regions[name];
  const img = art.images[name];
  if (!img) return;
  ctx.drawImage(
    img,
    (r.ox - BIRD_BOX / 2) * sc,
    (r.oy - BIRD_BOX / 2) * sc,
    r.w * sc,
    r.h * sc,
  );
}

// bird_lightning_bolt: slides in from the upper right and strikes the bird,
// visible for the first 0.2s of the crash. (x, y) = bird anchor, vs = view.s.
export function drawLightningBolt(ctx, x, y, vs, t) {
  if (t >= 0.2) return;
  const img = art.images.bird_lightning_bolt;
  const r = art.manifest.regions.bird_lightning_bolt;
  if (!img) return;

  const p = Math.min(1, t / 0.1333);
  // Where the bolt's visual tip sits relative to its box centre after the
  // 37.5deg strike rotation and (0.766, 0.5) scale — measured from the sprite
  // (tip pixel 497,1876 in the 814x1885 content). The end of the slide places
  // the tip exactly on the bird anchor; the slide direction matches Spine.
  const TIP_X = -284.3;
  const TIP_Y = 369.2;
  const dx = -TIP_X + lerp(571.05, 0, p);
  const dy = -TIP_Y - lerp(970.48, 0, p);
  const sx = 0.5 * 1.5316; // setup bone scale * animation scale
  const sy = 0.5;

  ctx.save();
  ctx.translate(x + dx * vs, y + dy * vs);
  ctx.rotate((37.51 * Math.PI) / 180);
  ctx.drawImage(
    img,
    (r.ox - r.ow / 2) * sx * vs,
    (r.oy - r.oh / 2) * sy * vs,
    r.w * sx * vs,
    r.h * sy * vs,
  );
  ctx.restore();
}
