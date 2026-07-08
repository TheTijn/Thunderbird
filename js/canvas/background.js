// Subdued background elements for the live scene: concentric ripples and
// forest/skyline silhouettes. Everything stays low-opacity per the brief.

let cacheKey = '';
let buildings = [];
let trees = [];

// Deterministic pseudo-random so silhouettes are stable across frames.
function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function rebuild(w, h) {
  cacheKey = `${w}x${h}`;
  buildings = [];
  trees = [];

  let x = w * 0.55;
  let i = 0;
  while (x < w) {
    const bw = w * (0.02 + seeded(i) * 0.035);
    const bh = h * (0.05 + seeded(i + 40) * 0.16);
    buildings.push({ x, w: bw, h: bh });
    x += bw + w * 0.006;
    i += 1;
  }

  x = 0;
  i = 100;
  while (x < w * 0.4) {
    const size = h * (0.03 + seeded(i) * 0.05);
    trees.push({ x, size });
    x += size * (0.8 + seeded(i + 7) * 0.6);
    i += 1;
  }
}

export function drawRipples(ctx, w, h, color, time) {
  const cx = w * 0.5;
  const cy = h * 0.45;
  const maxR = Math.max(w, h) * 0.75;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(6, h * 0.022);
  const phase = (time * 0.02) % 1;
  for (let i = 0; i < 7; i += 1) {
    const r = maxR * ((i + phase) / 7) ** 1.25;
    if (r < 6) continue;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSilhouettes(ctx, w, h, color, windowColor) {
  if (cacheKey !== `${w}x${h}`) rebuild(w, h);
  const base = h;

  ctx.save();
  // skyline (right side)
  ctx.fillStyle = color;
  buildings.forEach((b) => {
    ctx.fillRect(b.x, base - b.h, b.w, b.h);
  });
  // lit windows
  ctx.fillStyle = windowColor;
  buildings.forEach((b, bi) => {
    const cols = Math.max(1, Math.floor(b.w / (w * 0.012)));
    const rows = Math.max(2, Math.floor(b.h / (h * 0.045)));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (seeded(bi * 31 + c * 7 + r) > 0.72) {
          ctx.fillRect(
            b.x + (c + 0.3) * (b.w / cols),
            base - b.h + (r + 0.3) * (b.h / rows),
            w * 0.004,
            h * 0.01,
          );
        }
      }
    }
  });

  // forest (left side): simple triangle pines
  ctx.fillStyle = color;
  trees.forEach((t) => {
    ctx.beginPath();
    ctx.moveTo(t.x, base);
    ctx.lineTo(t.x + t.size * 0.5, base - t.size * 1.6);
    ctx.lineTo(t.x + t.size, base);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}
