// Final art loader. Sprites are sliced from the delivered Spine atlas by
// scripts/extract-atlas.mjs into assets/img/, together with manifest.json
// holding each sprite's placement in the 1920x1080 design space (computed from
// the Spine setup pose). The canvas maps design space onto itself with a
// cover fit, so the scene composition always matches the mock-ups.

const IMG_DIR = 'assets/img';

// Sprites the canvas draws (loading_screen* are used by the DOM instead).
// The backdrop is a procedural starry sky (see background.js); only the
// cloud strips and their lightning flickers survive from the scenery art.
const CANVAS_SPRITES = [
  'top_cloud1', 'top_cloud2', 'top_cloud3',
  'top_cloud1_lightning1', 'top_cloud1_lightning2',
  'top_cloud2_lightning1', 'top_cloud2_lightning2',
  'bird_electrocuted', 'bird_static', 'bird_lightning_bolt',
];

export const art = {
  manifest: null,
  images: {},   // region name -> HTMLImageElement
  frames: [],   // 9 composed flight frames
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.error(`[art] failed to load ${src}`);
      resolve(null);
    };
    img.src = src;
  });
}

export async function loadArt() {
  art.manifest = await (await fetch(`${IMG_DIR}/manifest.json`)).json();
  const jobs = CANVAS_SPRITES.map(async (name) => {
    art.images[name] = await loadImage(`${IMG_DIR}/${name}.png`);
  });
  for (let i = 1; i <= art.manifest.birdFrames.count; i += 1) {
    jobs.push(loadImage(`${IMG_DIR}/bird_frame_0${i}.png`).then((img) => {
      art.frames[i - 1] = img;
    }));
  }
  await Promise.all(jobs);
}

// Cover-fit of the 1920x1080 design space onto the canvas.
// s = px per design unit; x/y = canvas position of the design origin.
export function coverView(w, h) {
  const s = Math.max(w / 1920, h / 1080);
  return { s, x: (w - 1920 * s) / 2, y: (h - 1080 * s) / 2 };
}

// Content box (design space) of a slot's sprite — used to anchor sprites
// that must tile in lock-step with another strip (cloud lightning).
export function slotContentBox(slotName) {
  const slot = art.manifest.slots[slotName];
  const region = art.manifest.regions[slot.attachment];
  return { left: slot.cx - region.ow / 2 + region.ox, width: region.w };
}

// Draws a slot tiled horizontally (scrolling cloud strips). The strips are
// not authored to loop, so alternate tiles are mirrored — every edge then
// meets its own reflection and the wrap never shows a seam.
// `anchor` ({left, width} in design px) overrides the tiling box, letting the
// cloud lightning tile in lock-step with its parent cloud strip.
export function drawSlotWrapped(ctx, view, slotName, scrollX, anchor = null) {
  const slot = art.manifest.slots[slotName];
  const region = art.manifest.regions[slot.attachment];
  const img = art.images[slot.attachment];
  if (!img) return;
  const content = slotContentBox(slotName);
  const box = anchor ?? content;
  const rel = content.left - box.left;             // content offset inside tile
  const relMirror = box.width - rel - region.w;    // ...when the tile mirrors
  const top = view.y + (slot.cy - (region.oh / 2 - region.oy)) * view.s;
  const drawW = region.w * view.s;
  const drawH = region.h * view.s;
  const periodPx = box.width * view.s;
  const basePx = view.x + (box.left + scrollX) * view.s;
  const canvasW = ctx.canvas.width; // upper bound; ctx transform is uniform dpr
  let n = Math.floor(-basePx / periodPx) - 1;
  for (; ; n += 1) {
    const tileX = basePx + n * periodPx;
    if (tileX > canvasW) break;
    if (tileX + periodPx < 0) continue;
    if (((n % 2) + 2) % 2 === 0) {
      ctx.drawImage(img, tileX + rel * view.s, top, drawW, drawH);
    } else {
      ctx.save();
      ctx.translate(tileX + relMirror * view.s + drawW, top);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, drawW, drawH);
      ctx.restore();
    }
  }
}

