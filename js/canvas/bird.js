// Sprite loader/drawer for the bird states. All art is flat SVG so it can be
// swapped for final assets without code changes.
const SOURCES = {
  flying: 'assets/svg/bird-flat.svg',
  skeleton: 'assets/svg/bird-skeleton.svg',
  chicken: 'assets/svg/roast-chicken.svg',
};

const images = {};

export function loadSprites() {
  return Promise.all(
    Object.entries(SOURCES).map(([name, src]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        images[name] = img;
        resolve();
      };
      img.onerror = () => {
        console.error(`[sprites] failed to load ${src}`);
        resolve();
      };
      img.src = src;
    })),
  );
}

// Draws a sprite centred on (x, y), rotated by angle, scaled to `width`.
export function drawSprite(ctx, name, x, y, { angle = 0, width = 80, alpha = 1, glow = null } = {}) {
  const img = images[name];
  if (!img || !img.naturalWidth) return;
  const height = width * (img.naturalHeight / img.naturalWidth);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = width * 0.22;
  }
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();
}
