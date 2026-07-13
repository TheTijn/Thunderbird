// One-off asset pipeline: slices the Spine texture atlas (art-src/) into the
// individual PNGs the canvas renderer draws, and writes assets/img/manifest.json
// with design-space (1920x1080) placement computed from the Spine setup pose.
//
//   node scripts/extract-atlas.mjs
//
// The atlas pages are exported with premultiplied alpha (pma:true); regions are
// composited in premultiplied space and un-premultiplied before writing, so the
// output PNGs are plain straight-alpha images.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = path.resolve('art-src');
const OUT = path.resolve('assets/img');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- atlas parse
function parseAtlas(text) {
  const lines = text.split(/\r?\n/);
  const pages = [];
  let page = null;
  let region = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { page = null; region = null; continue; }
    if (!page) {
      page = { file: line.trim(), regions: [] };
      pages.push(page);
      continue;
    }
    if (line.includes(':')) {
      const [key, value] = line.split(':').map((s) => s.trim());
      const nums = value.split(',').map((s) => Number(s.trim()));
      const target = region ?? page;
      target[key] = Number.isNaN(nums[0]) ? value : nums;
    } else {
      region = { name: line.trim() };
      page.regions.push(region);
    }
  }
  return pages;
}

// ------------------------------------------------------------------ image ops
function loadPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function savePng(img, name) {
  fs.writeFileSync(path.join(OUT, name), PNG.sync.write(img, { deflateLevel: 9 }));
}

// Extract a region (premultiplied pixels) from a page. Handles rotate:90
// (regions are packed rotated 90deg clockwise; we rotate back CCW).
function extractRegion(page, r) {
  const [x, y, w, h] = r.bounds;
  const rotated = r.rotate?.[0] === 90 || r.rotate === '90';
  const out = new PNG({ width: w, height: h });
  const src = page.data;
  const pw = page.width;
  if (!rotated) {
    for (let row = 0; row < h; row += 1) {
      src.copy(out.data, row * w * 4, ((y + row) * pw + x) * 4, ((y + row) * pw + x + w) * 4);
    }
  } else {
    // packed rect is h wide, w tall; stored = original rotated 90deg CCW:
    // orig(px, py) = stored(py, w - 1 - px)
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        const sx = x + py;
        const sy = y + (w - 1 - px);
        const si = (sy * pw + sx) * 4;
        const di = (py * w + px) * 4;
        src.copy(out.data, di, si, si + 4);
      }
    }
  }
  return out;
}

function unpremultiply(img) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a > 0 && a < 255) {
      d[i] = Math.min(255, Math.round((d[i] * 255) / a));
      d[i + 1] = Math.min(255, Math.round((d[i + 1] * 255) / a));
      d[i + 2] = Math.min(255, Math.round((d[i + 2] * 255) / a));
    }
  }
  return img;
}

// Premultiplied "over" compositing: dst = src + dst * (1 - srcA)
function compose(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y += 1) {
    const ty = dy + y;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x += 1) {
      const tx = dx + x;
      if (tx < 0 || tx >= dst.width) continue;
      const si = (y * src.width + x) * 4;
      const di = (ty * dst.width + tx) * 4;
      const sa = src.data[si + 3] / 255;
      if (sa === 0) continue;
      for (let c = 0; c < 4; c += 1) {
        dst.data[di + c] = Math.min(255, Math.round(src.data[si + c] + dst.data[di + c] * (1 - sa)));
      }
    }
  }
}

function crop(img, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let row = 0; row < h; row += 1) {
    img.data.copy(out.data, row * w * 4, ((y + row) * img.width + x) * 4, ((y + row) * img.width + x + w) * 4);
  }
  return out;
}

function alphaBounds(img) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (img.data[(y * img.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

// ------------------------------------------------------- spine setup-pose math
const skel = JSON.parse(fs.readFileSync(path.join(SRC, 'thunderbird_FINAL.json'), 'utf8'));

const boneByName = {};
for (const b of skel.bones) boneByName[b.name] = b;

function mat(tx, ty, rotDeg, sx = 1, sy = 1) {
  const r = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { a: cos * sx, b: sin * sx, c: -sin * sy, d: cos * sy, tx, ty };
}
function mul(m, n) {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    tx: m.a * n.tx + m.c * n.ty + m.tx,
    ty: m.b * n.tx + m.d * n.ty + m.ty,
  };
}
function boneWorld(name) {
  const b = boneByName[name];
  const local = mat(b.x ?? 0, b.y ?? 0, b.rotation ?? 0, b.scaleX ?? 1, b.scaleY ?? 1);
  return b.parent ? mul(boneWorld(b.parent), local) : local;
}

const slotDefs = skel.slots;
const skin = skel.skins[0].attachments;

// world (skeleton-space, y-up) placement of a slot's setup attachment
function slotWorld(slotName, attachmentName) {
  const slot = slotDefs.find((s) => s.name === slotName);
  const attName = attachmentName ?? slot.attachment;
  const att = skin[slotName][attName];
  const m = mul(boneWorld(slot.bone), mat(att.x ?? 0, att.y ?? 0, att.rotation ?? 0));
  const rot = (Math.atan2(m.b, m.a) * 180) / Math.PI;
  const sx = Math.hypot(m.a, m.b);
  const sy = Math.hypot(m.c, m.d);
  return { x: m.tx, y: m.ty, rot, sx, sy, w: att.width, h: att.height, attachment: attName };
}

// Anchor the design space so the `background` attachment covers 1920x1080.
const bg = slotWorld('background');
function toDesign(p) {
  return { cx: 960 + (p.x - bg.x), cy: 540 - (p.y - bg.y) };
}

// ------------------------------------------------------------------- extract
const pages = parseAtlas(fs.readFileSync(path.join(SRC, 'thunderbird_FINAL.atlas'), 'utf8'));
const page1 = pages[0];
console.log(`page ${page1.file}: ${page1.regions.length} regions`);
const pageImg = loadPng(path.join(SRC, page1.file));

const regionByName = {};
for (const r of page1.regions) regionByName[r.name] = r;

const manifest = { regions: {}, slots: {}, birdFrames: null };

function regionMeta(r) {
  const [, , w, h] = r.bounds;
  const [ox, oyBottom, ow, oh] = r.offsets ?? [0, 0, w, h];
  return { w, h, ox, oy: oh - oyBottom - h, ow, oh }; // oy from top-left
}

const SINGLES = [
  'background', 'city_skyline', 'tree_line_back', 'tree_line_front',
  'top_cloud1', 'top_cloud2', 'top_cloud3',
  'top_cloud1_lightning1', 'top_cloud1_lightning2',
  'top_cloud2_lightning1', 'top_cloud2_lightning2',
  'bird_electrocuted', 'bird_static', 'bird_dead', 'bird_steam',
  'bird_lightning_bolt', 'bird_shadow', 'bird_endscreen',
  'loading_screen', 'loading_screen_bird', 'loading_screen_fill', 'loading_screen_mask',
];

for (const name of SINGLES) {
  const r = regionByName[name];
  const img = unpremultiply(extractRegion(pageImg, r));
  // The loading mask is authored as a negative: an opaque patch of backdrop
  // with a transparent bird-shaped hole (drawn over the fill in Spine).
  // Invert its alpha so it becomes a positive CSS alpha mask for the fill.
  if (name === 'loading_screen_mask') {
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255 - img.data[i + 3];
    }
  }
  savePng(img, `${name}.png`);
  manifest.regions[name] = regionMeta(r);
  console.log(`saved ${name}.png ${img.width}x${img.height}`);
}

// slot placements (design space, y-down, rot = CCW degrees in y-up space)
const SLOTS = [
  ['background'], ['city_skyline'], ['tree_line_back'], ['tree_line_front'],
  ['top_cloud1'], ['top_cloud2'], ['top_cloud3'],
  ['top_cloud1_lightning3'], ['top_cloud1_lightning4'],
  ['top_cloud2_lightning1'], ['top_cloud2_lightning2'],
  ['bird_electrocuted'], ['bird_static'], ['bird_dead'], ['bird_steam'],
  ['bird_lightning_bolt'], ['bird_shadow'], ['bird_endscreen'],
];
for (const [slotName, attName] of SLOTS) {
  const p = slotWorld(slotName, attName);
  const { cx, cy } = toDesign(p);
  manifest.slots[slotName] = {
    cx: +cx.toFixed(2),
    cy: +cy.toFixed(2),
    rot: +p.rot.toFixed(2),
    sx: +p.sx.toFixed(4),
    sy: +p.sy.toFixed(4),
    w: p.w,
    h: p.h,
    attachment: p.attachment,
  };
}

// ------------------------------------------------- compose bird flight frames
// Slot draw order (back to front) from the skeleton's slots list.
const FRAME_PIECES = (n) => [
  'bird_leg_back',
  `bird_frame_0${n}_tail`,
  `bird_frame_0${n}_wing_back`,
  'bird_body',
  'bird_leg_front',
  'bird_beak',
  `bird_frame_0${n}_wing_front`,
];

const frames = [];
for (let n = 1; n <= 9; n += 1) {
  const canvas = new PNG({ width: 885, height: 885 });
  for (const piece of FRAME_PIECES(n)) {
    const r = regionByName[piece];
    const img = extractRegion(pageImg, r); // premultiplied
    const meta = regionMeta(r);
    compose(canvas, img, meta.ox, meta.oy);
  }
  frames.push(canvas);
}

// union crop across all frames so every frame shares one anchor
let u = null;
for (const f of frames) {
  const b = alphaBounds(f);
  u = u
    ? {
      minX: Math.min(u.minX, b.minX), minY: Math.min(u.minY, b.minY),
      maxX: Math.max(u.maxX, b.maxX), maxY: Math.max(u.maxY, b.maxY),
    }
    : b;
}
const fw = u.maxX - u.minX + 1;
const fh = u.maxY - u.minY + 1;
frames.forEach((f, i) => {
  savePng(unpremultiply(crop(f, u.minX, u.minY, fw, fh)), `bird_frame_0${i + 1}.png`);
});
console.log(`saved 9 bird frames ${fw}x${fh} (crop origin ${u.minX},${u.minY})`);

// design placement of the composed 885x885 frame = bird_body slot
const birdBody = slotWorld('bird_body');
const birdDesign = toDesign(birdBody);
manifest.birdFrames = {
  count: 9,
  w: fw,
  h: fh,
  // position of the frame's crop origin relative to the 885 box centre
  cropX: u.minX - 442.5,
  cropY: u.minY - 442.5,
  cx: +birdDesign.cx.toFixed(2),
  cy: +birdDesign.cy.toFixed(2),
};

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('wrote manifest.json');
