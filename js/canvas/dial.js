// Faint dial behind the multiplier: partial arcs with low-opacity tick marks
// and small multiplier labels. Decorative only — must stay subdued.

const TICKS = [
  { label: '1.00x', frac: 0.0 },
  { label: '1.20x', frac: 0.2 },
  { label: '1.40x', frac: 0.4 },
  { label: '1.80x', frac: 0.62 },
  { label: '2.00x', frac: 0.8 },
  { label: '5.00x', frac: 1.0 },
];

export function drawDial(ctx, w, h, theme, alpha = 1) {
  const cx = w * 0.5;
  const cy = h * 0.98;
  const r = Math.min(w, h * 1.6) * 0.52;
  const startAngle = Math.PI * 1.02; // just past left horizontal
  const endAngle = Math.PI * 1.98;   // just before right horizontal

  ctx.save();
  ctx.globalAlpha = alpha;

  // main arc
  ctx.strokeStyle = theme.dial;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.stroke();

  // ticks + labels
  ctx.fillStyle = theme.dialText;
  ctx.font = `600 ${Math.max(10, h * 0.028)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  TICKS.forEach(({ label, frac }) => {
    const angle = startAngle + (endAngle - startAngle) * frac;
    const inner = r - h * 0.02;
    const outer = r + h * 0.02;
    ctx.strokeStyle = theme.dial;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();

    const lx = cx + Math.cos(angle) * (r + h * 0.07);
    const ly = cy + Math.sin(angle) * (r + h * 0.07);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  ctx.restore();
}
