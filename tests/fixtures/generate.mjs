#!/usr/bin/env node
// Deterministically generate the synthetic test fixtures (no network, no deps):
//   illustration.png — flat shapes / few colors / sharp edges (lossless-friendly,
//                       exposes JPEG ringing).
//   transparent.png  — RGBA with a full alpha range (tests alpha preservation).
// The photographic fixtures (photo.jpg, photo-large.jpg) are downloaded real
// photos (see tests/fixtures/README.md) — synthetic noise isn't representative
// of real photo entropy, so those are not generated here.
import { crc32, deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodePngGray1(w, h, value) {
  const stride = Math.ceil(w / 8);
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.fill(value ? 0xff : 0x00, y * (stride + 1) + 1, (y + 1) * (stride + 1));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // color type: grayscale
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const canvas = (w, h, [r, g, b, a]) => {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) buf.set([r, g, b, a], i * 4);
  return buf;
};
const px = (buf, w, x, y, c) => {
  if (x < 0 || y < 0 || x >= w) return;
  buf.set(c, (y * w + x) * 4);
};
const rect = (buf, w, x0, y0, x1, y1, c) => {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) px(buf, w, x, y, c);
};
const disc = (buf, w, cx, cy, r, c) => {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(buf, w, x, y, c);
};

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const W = 512;
const H = 512;

// --- illustration: flat colours, sharp edges, ~6 colours ---
{
  const buf = canvas(W, H, [245, 245, 245, 255]); // off-white bg
  rect(buf, W, 40, 40, 240, 240, [220, 50, 47, 255]); // red square
  disc(buf, W, 360, 150, 90, [38, 139, 210, 255]); // blue circle
  rect(buf, W, 60, 300, 460, 380, [133, 153, 0, 255]); // green bar
  disc(buf, W, 150, 410, 60, [181, 137, 0, 255]); // amber circle
  rect(buf, W, 300, 300, 470, 470, [108, 113, 196, 255]); // violet square
  writeFileSync(here('./illustration.png'), encodePng(W, H, buf));
  console.log('wrote illustration.png');
}

// --- transparent: full alpha range over an opaque shape ---
{
  const buf = canvas(W, H, [0, 0, 0, 0]); // fully transparent bg
  disc(buf, W, 256, 256, 150, [211, 54, 130, 255]); // opaque magenta disc
  // horizontal alpha gradient band (alpha 0 -> 255) over a teal fill
  for (let x = 0; x < W; x++) {
    const a = Math.round((x / (W - 1)) * 255);
    for (let y = 430; y < 500; y++) px(buf, W, x, y, [42, 161, 152, a]);
  }
  writeFileSync(here('./transparent.png'), encodePng(W, H, buf));
  console.log('wrote transparent.png');
}

// --- tiny-flat: tiny single-colour PNG for keep-original export guards ---
{
  writeFileSync(here('./tiny-flat.png'), encodePngGray1(256, 256, 1));
  console.log('wrote tiny-flat.png');
}

// ---------------------------------------------------------------------------
// Expanded corpus (added for codec-bench diversity). All deterministic.
// A seeded PRNG (mulberry32) is used everywhere we need "randomness" — never
// Math.random()/Date.now(), so output is byte-identical across runs/machines.
// ---------------------------------------------------------------------------

// mulberry32: tiny, fast, deterministic 32-bit PRNG → float in [0, 1).
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
// 4×4 ordered (Bayer) threshold matrix, values 0..15.
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Shared gradient field for gradient.png / gradient-dithered.png: a diagonal
// linear ramp blended with a radial falloff, in continuous float RGB. Keeping a
// single source means the two fixtures differ ONLY by the dithering step.
const gradientRgb = (x, y) => {
  const lin = (x + y) / (2 * (W - 1)); // 0..1 diagonal
  const dx = x - W / 2;
  const dy = y - H / 2;
  const rad = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (W / 2)); // 0..1 radial
  return [
    20 + lin * 215, // red ramps along the diagonal
    200 - rad * 180, // green falls off radially (bright center)
    40 + lin * 100 + rad * 90, // blue mixes both
  ];
};

// --- gradient: smooth multi-stop gradient, NO dither (stresses banding) ---
{
  const buf = canvas(W, H, [0, 0, 0, 255]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = gradientRgb(x, y);
      px(buf, W, x, y, [clamp8(r), clamp8(g), clamp8(b), 255]);
    }
  writeFileSync(here('./gradient.png'), encodePng(W, H, buf));
  console.log('wrote gradient.png');
}

// --- gradient-dithered: SAME gradient with ordered (Bayer) dithering ---
{
  const buf = canvas(W, H, [0, 0, 0, 255]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = gradientRgb(x, y);
      // Ordered dither: nudge by the Bayer threshold (centered on 0) so the
      // rounding to 8-bit breaks up flat bands into a fixed noise pattern.
      const t = (BAYER4[y & 3][x & 3] + 0.5) / 16 - 0.5; // -0.5..+0.5
      px(buf, W, x, y, [clamp8(r + t), clamp8(g + t), clamp8(b + t), 255]);
    }
  writeFileSync(here('./gradient-dithered.png'), encodePng(W, H, buf));
  console.log('wrote gradient-dithered.png');
}

// --- hard-edges: high-contrast B/W concentric rings + a checker quadrant ---
// Zone-plate-like: lots of sharp 1px transitions to stress ringing.
{
  const buf = canvas(W, H, [255, 255, 255, 255]);
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      // Concentric rings: alternate black/white every 8px of radius.
      let on = (Math.floor(r / 8) & 1) === 0;
      // Bottom-right quadrant: overlay an 8×8 checkerboard instead.
      if (x >= cx && y >= cy) on = ((x >> 3) + (y >> 3)) % 2 === 0;
      const v = on ? 0 : 255;
      px(buf, W, x, y, [v, v, v, 255]);
    }
  writeFileSync(here('./hard-edges.png'), encodePng(W, H, buf));
  console.log('wrote hard-edges.png');
}

// --- noise-synthetic: full-frame seeded pseudo-random RGB noise ---
// Incompressible worst case: QOI catastrophe, lossless overhead floor, and a
// near-constant-size regression canary.
{
  const rnd = mulberry32(0x5eed_1234);
  const buf = canvas(W, H, [0, 0, 0, 255]);
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = (rnd() * 256) | 0;
    buf[i * 4 + 1] = (rnd() * 256) | 0;
    buf[i * 4 + 2] = (rnd() * 256) | 0;
    buf[i * 4 + 3] = 255;
  }
  writeFileSync(here('./noise-synthetic.png'), encodePng(W, H, buf));
  console.log('wrote noise-synthetic.png');
}

// --- screenshot: synthetic UI (panels + title bar + bitmap text + 1px rules) ---
// Stresses text + flat fills + sharp edges (JXL-modular & WebP-lossless win;
// AVIF-lossless weak). Text uses a hardcoded 5×7 bitmap font — no font deps.
{
  const SW = 1280;
  const SH = 800;
  const buf = canvas(SW, SH, [246, 247, 249, 255]); // light app background

  // 5×7 bitmap font: each glyph is 7 rows, each row a 5-bit mask (MSB = left).
  // Digits, uppercase A–Z, and a handful of punctuation — enough for UI text.
  const FONT = {
    ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    2: [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
    3: [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
    4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
    8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
    A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
    E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
    H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
    J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
    K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
    N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
    T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
    W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
    X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
    '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
    ',': [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
    ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
    '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
    '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
    '%': [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
    '#': [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  };
  // Blit a string at (x, y) with an integer pixel scale and a colour. Unknown
  // characters fall back to space.
  const text = (s, x0, y0, scale, c) => {
    let cx = x0;
    for (const ch of s.toUpperCase()) {
      const glyph = FONT[ch] ?? FONT[' '];
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 5; gx++)
          if (glyph[gy] & (1 << (4 - gx)))
            rect(
              buf,
              SW,
              cx + gx * scale,
              y0 + gy * scale,
              cx + gx * scale + scale,
              y0 + gy * scale + scale,
              c,
            );
      cx += 6 * scale; // 5px glyph + 1px gap
    }
  };
  const hrule = (x0, x1, y, c) => rect(buf, SW, x0, y, x1, y + 1, c);

  const ink = [33, 37, 41, 255];
  const muted = [108, 117, 125, 255];
  const line = [222, 226, 230, 255];

  // Title bar
  rect(buf, SW, 0, 0, SW, 56, [255, 255, 255, 255]);
  hrule(0, SW, 56, line);
  text('PRESK DASHBOARD', 24, 22, 2, ink);
  text('FILE  EDIT  VIEW  HELP', 520, 24, 1, muted);

  // Left sidebar panel
  rect(buf, SW, 0, 56, 240, SH, [250, 250, 251, 255]);
  rect(buf, SW, 240, 56, 241, SH, line);
  const navItems = ['OVERVIEW', 'PROJECTS', 'BENCHMARKS', 'SETTINGS', 'ABOUT'];
  navItems.forEach((label, i) => text(label, 24, 96 + i * 36, 2, ink));

  // Main content: two flat cards with titles + value rows.
  const card = (x, y, w, h, title, rows) => {
    rect(buf, SW, x, y, x + w, y + h, [255, 255, 255, 255]);
    // 1px border
    hrule(x, x + w, y, line);
    hrule(x, x + w, y + h - 1, line);
    rect(buf, SW, x, y, x + 1, y + h, line);
    rect(buf, SW, x + w - 1, y, x + w, y + h, line);
    text(title, x + 16, y + 16, 2, ink);
    hrule(x + 16, x + w - 16, y + 44, line);
    rows.forEach(([k, v], i) => {
      const ry = y + 64 + i * 28;
      text(k, x + 16, ry, 1, muted);
      text(v, x + w - 16 - v.length * 6, ry, 1, ink);
    });
  };
  card(280, 96, 440, 240, 'ENCODE STATS', [
    ['ORIGINAL SIZE', '2048 KB'],
    ['WEBP', '512 KB / 75%'],
    ['AVIF', '384 KB / 81%'],
    ['JPEG XL', '402 KB / 80%'],
    ['MOZJPEG', '598 KB / 71%'],
  ]);
  card(760, 96, 440, 240, 'CODEC STATUS', [
    ['WEBP', 'OK'],
    ['AVIF', 'OK'],
    ['JPEG XL', 'OK'],
    ['OXIPNG', 'OK'],
    ['QOI', 'OK'],
  ]);

  // A wide table-like panel with rules between rows.
  rect(buf, SW, 280, 360, 1200, 720, [255, 255, 255, 255]);
  hrule(280, 1200, 360, line);
  hrule(280, 1200, 719, line);
  text('RECENT RUNS', 296, 376, 2, ink);
  for (let i = 0; i < 9; i++) {
    const ry = 420 + i * 32;
    hrule(296, 1184, ry - 8, line);
    text(`RUN ${100 + i}`, 296, ry, 1, ink);
    text(`${1000 + i * 37} MS`, 560, ry, 1, muted);
    text(`${80 + i}%`, 900, ry, 1, muted);
  }

  // Footer rule + caption
  hrule(280, 1200, 740, line);
  text('GENERATED FIXTURE - NO REAL DATA', 296, 756, 1, muted);

  writeFileSync(here('./screenshot.png'), encodePng(SW, SH, buf));
  console.log('wrote screenshot.png');
}
