// Faint dial behind the multiplier: a fixed arc whose multiplier tick marks
// rotate so the tick matching the live multiplier always sits under the centre
// pointer (top of the arc, directly beneath the big multiplier badge).
// Decorative only — must stay subdued.
//
// Each tick's angle is proportional to ln(multiplier). Since the game
// multiplier itself grows as e^(growthRate·t), ln(multiplier) is linear in
// time, so the dial rotates at a constant angular speed and every tick crosses
// the centre pointer at the exact instant the live multiplier equals that
// tick's value.

// Labelled multiplier ticks, ascending.
const TICKS = [1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10, 15, 20, 30, 50, 100, 200, 500];

const TOP = Math.PI * 1.5;    // centre pointer — top of the arc
const START = Math.PI * 1.02; // arc start (just past left horizontal)
const END = Math.PI * 1.98;   // arc end   (just before right horizontal)
const HALF = (END - START) / 2;
const SPREAD = 1.9;           // radians of arc travelled per unit of ln(multiplier)

function label(m) {
  return `${m < 10 ? m.toFixed(2) : String(Math.round(m))}x`;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function drawDial(ctx, w, h, theme, alpha = 1, mult = 1) {
  const cx = w * 0.5;
  const cy = h * 0.98;
  const r = Math.min(w, h * 1.6) * 0.52;
  const lnC = Math.log(Math.max(1, mult));

  ctx.save();

  // base arc (fixed — the ticks rotate along it)
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = theme.dial;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, START, END);
  ctx.stroke();

  ctx.font = `600 ${Math.max(10, h * 0.028)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const inner = r - h * 0.02;
  const outer = r + h * 0.02;

  for (const m of TICKS) {
    // Higher multipliers sit to the right of the pointer, lower to the left; as
    // the live multiplier climbs, ln(mult) grows and every tick slides left,
    // crossing the top pointer exactly when the live multiplier equals it.
    const angle = TOP + SPREAD * (Math.log(m) - lnC);
    if (angle < START || angle > END) continue; // off the visible arc

    // fade ticks in/out near the arc edges so they don't pop
    const edgeFade = clamp((HALF - Math.abs(angle - TOP)) / (HALF * 0.18), 0, 1);
    if (edgeFade <= 0) continue;
    ctx.globalAlpha = alpha * edgeFade;

    ctx.strokeStyle = theme.dial;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();

    const lx = cx + Math.cos(angle) * (r + h * 0.07);
    const ly = cy + Math.sin(angle) * (r + h * 0.07);
    ctx.fillStyle = theme.dialText;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(label(m), 0, 0);
    ctx.restore();
  }

  ctx.restore();
}
