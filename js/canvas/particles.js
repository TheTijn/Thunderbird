// Neon spark trail + crash burst. Rendered additively for glow.
export class ParticleSystem {
  constructor() {
    this.items = [];
  }

  spawn(x, y, angle, speed, life, size) {
    this.items.push({
      x,
      y,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * speed * 0.5,
      vy: Math.sin(angle) * speed + (Math.random() - 0.5) * speed * 0.5,
      life,
      maxLife: life,
      size,
    });
  }

  // continuous trail behind the curve head
  trail(x, y, headAngleRad, scale) {
    const back = headAngleRad + Math.PI;
    for (let i = 0; i < 3; i += 1) {
      this.spawn(
        x,
        y,
        back + (Math.random() - 0.5) * 0.9,
        (40 + Math.random() * 90) * scale,
        0.45 + Math.random() * 0.75,
        (1.2 + Math.random() * 2.4) * scale,
      );
    }
  }

  burst(x, y, count, scale) {
    for (let i = 0; i < count; i += 1) {
      this.spawn(
        x,
        y,
        Math.random() * Math.PI * 2,
        (120 + Math.random() * 260) * scale,
        0.5 + Math.random() * 0.9,
        (1.5 + Math.random() * 3.5) * scale,
      );
    }
  }

  update(dt) {
    this.items = this.items.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt; // slight gravity on sparks
      return true;
    });
  }

  draw(ctx, color) {
    if (!this.items.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    this.items.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.85;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  clear() {
    this.items = [];
  }
}
