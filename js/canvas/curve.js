import { multiplierAtTime } from '../sim/rng.js';

// Plot geometry + exponential curve rendering.
// Time maps linearly to x; the multiplier maps log-ish to y with a growing
// window so the leading edge stays inside the frame (standard crash pattern).

export function plotArea(w, h) {
  return {
    left: w * 0.055,
    right: w * 0.93,
    bottom: h * 0.92,
    top: h * 0.3,
  };
}

export function computeCurvePoints(elapsed, w, h) {
  const plot = plotArea(w, h);
  const tMax = Math.max(9, elapsed * 1.12);
  const m = multiplierAtTime(elapsed);
  // Linear-in-multiplier vertical mapping keeps the exponential bow visible;
  // the window grows with the value so the head stays inside the frame.
  const mMax = Math.max(2.2, m * 1.5);

  const points = [];
  const samples = 130;
  for (let i = 0; i <= samples; i += 1) {
    const t = (elapsed * i) / samples;
    const mt = multiplierAtTime(t);
    const x = plot.left + (t / tMax) * (plot.right - plot.left);
    const y = plot.bottom - ((mt - 1) / (mMax - 1)) * (plot.bottom - plot.top);
    points.push({ x, y });
  }
  return points;
}

export function drawCurve(ctx, points, theme, w, h) {
  if (points.length < 2) return;
  const plot = plotArea(w, h);
  const head = points[points.length - 1];

  // shaded area under the curve
  const fill = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
  fill.addColorStop(0, theme.curveFillTop);
  fill.addColorStop(1, theme.curveFillBottom);
  ctx.beginPath();
  ctx.moveTo(points[0].x, plot.bottom);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(head.x, plot.bottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  // glow pass + core line
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = theme.curve;
  ctx.shadowBlur = Math.max(10, h * 0.03);

  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = theme.curve;
  ctx.lineWidth = Math.max(3, h * 0.009);
  ctx.stroke();
  ctx.stroke(); // second pass strengthens the glow
  ctx.restore();

  // faint vertical drop line from the head to the baseline
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = theme.curve;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x, plot.bottom);
  ctx.stroke();
  // baseline
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
  ctx.restore();

  // glowing dot at the head
  ctx.save();
  ctx.fillStyle = theme.curve;
  ctx.shadowColor = theme.curve;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(head.x, head.y, Math.max(3, h * 0.008), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Angle of the curve at its head (bird orientation).
export function headAngle(points) {
  if (points.length < 2) return 0;
  const a = points[Math.max(0, points.length - 6)];
  const b = points[points.length - 1];
  return Math.atan2(b.y - a.y, b.x - a.x);
}
