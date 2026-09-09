/* Regenerate every favicon / PWA / Android launcher + splash asset from the
   supplied icon-only mark src/assets/logo/plogo.png. No external deps. */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const ROOT = process.argv[2] || process.cwd();
const SRC = path.join(ROOT, 'src/assets/logo/plogo.png');

// ---------- PNG decode ----------
function decodePNG(buf) {
  let p = 8; const chunks = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); chunks.push({ type, start: p + 8, len }); p += 12 + len; }
  const ih = chunks.find(c => c.type === 'IHDR');
  const w = buf.readUInt32BE(ih.start), h = buf.readUInt32BE(ih.start + 4);
  const bitDepth = buf[ih.start + 8], colorType = buf[ih.start + 9];
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) throw new Error('unsupported PNG ' + bitDepth + '/' + colorType);
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => buf.slice(c.start, c.start + c.len))));
  const stride = w * channels;
  const cur = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)]; const off = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const rb = raw[off + x];
      const a = x >= channels ? cur[y * stride + x - channels] : 0;
      const u = y > 0 ? cur[(y - 1) * stride + x] : 0;
      const c = (x >= channels && y > 0) ? cur[(y - 1) * stride + x - channels] : 0;
      let v;
      if (ft === 0) v = rb; else if (ft === 1) v = rb + a; else if (ft === 2) v = rb + u; else if (ft === 3) v = rb + ((a + u) >> 1); else v = rb + paeth(a, u, c);
      cur[y * stride + x] = v & 255;
    }
  }
  // normalise to RGBA
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = cur[i * channels];
    out[i * 4 + 1] = cur[i * channels + 1];
    out[i * 4 + 2] = cur[i * channels + 2];
    out[i * 4 + 3] = channels === 4 ? cur[i * channels + 3] : 255;
  }
  return { w, h, data: out };
}

// ---------- PNG encode (adaptive filter) ----------
function encodePNG({ w, h, data }) {
  const stride = w * 4;
  const filt = Buffer.alloc(h * (stride + 1));
  const paeth = (a, b, c) => { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    let best = null, bestType = 0, bestScore = Infinity;
    for (let ft = 0; ft < 5; ft++) {
      const row = Buffer.alloc(stride); let score = 0;
      for (let x = 0; x < stride; x++) {
        const cur = data[y * stride + x];
        const a = x >= 4 ? data[y * stride + x - 4] : 0;
        const u = y > 0 ? data[(y - 1) * stride + x] : 0;
        const c = (x >= 4 && y > 0) ? data[(y - 1) * stride + x - 4] : 0;
        let v;
        if (ft === 0) v = cur; else if (ft === 1) v = cur - a; else if (ft === 2) v = cur - u; else if (ft === 3) v = cur - ((a + u) >> 1); else v = cur - paeth(a, u, c);
        v &= 255; row[x] = v; score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; bestType = ft; best = row; }
    }
    filt[y * (stride + 1)] = bestType; best.copy(filt, y * (stride + 1) + 1);
  }
  const comp = zlib.deflateSync(filt, { level: 9 });
  const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, d) => { const b = Buffer.alloc(8 + d.length + 4); b.writeUInt32BE(d.length, 0); b.write(type, 4, 'ascii'); d.copy(b, 8); b.writeUInt32BE(crc32(b.slice(4, 8 + d.length)), 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- ops ----------
function cropToContent(img, thr = 12) {
  const { w, h, data } = img; let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > thr) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const cw = maxX - minX + 1, chh = maxY - minY + 1;
  const out = Buffer.alloc(cw * chh * 4);
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) for (let k = 0; k < 4; k++) out[(y * cw + x) * 4 + k] = data[((minY + y) * w + (minX + x)) * 4 + k];
  return { w: cw, h: chh, data: out };
}
// area-average resize to exact w/h
function resize(img, dw, dh) {
  const { w, h, data } = img; const out = Buffer.alloc(dw * dh * 4);
  for (let dy = 0; dy < dh; dy++) for (let dx = 0; dx < dw; dx++) {
    const sx0 = dx * w / dw, sx1 = (dx + 1) * w / dw, sy0 = dy * h / dh, sy1 = (dy + 1) * h / dh;
    let r = 0, g = 0, b = 0, a = 0, aw = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      const cwx = Math.min(sx + 1, sx1) - Math.max(sx, sx0), cwy = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
      const area = cwx * cwy; const i = (Math.min(sy, h - 1) * w + Math.min(sx, w - 1)) * 4; const av = data[i + 3];
      r += data[i] * av * area; g += data[i + 1] * av * area; b += data[i + 2] * av * area; a += av * area; aw += area;
    }
    const o = (dy * dw + dx) * 4;
    out[o] = a > 0 ? Math.round(r / a) : 0; out[o + 1] = a > 0 ? Math.round(g / a) : 0; out[o + 2] = a > 0 ? Math.round(b / a) : 0; out[o + 3] = Math.round(a / aw);
  }
  return { w: dw, h: dh, data: out };
}
function blank(size, rgba = [0, 0, 0, 0]) {
  const data = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) { data[i * 4] = rgba[0]; data[i * 4 + 1] = rgba[1]; data[i * 4 + 2] = rgba[2]; data[i * 4 + 3] = rgba[3]; }
  return { w: size, h: size, data };
}
// alpha-composite src onto dst at (ox,oy)
function composite(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const dx = ox + x, dy = oy + y; if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
    const s = (y * src.w + x) * 4, d = (dy * dst.w + dx) * 4;
    const sa = src.data[s + 3] / 255; if (sa === 0) continue;
    const da = dst.data[d + 3] / 255; const oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) dst.data[d + k] = Math.round((src.data[s + k] * sa + dst.data[d + k] * da * (1 - sa)) / (oa || 1));
    dst.data[d + 3] = Math.round(oa * 255);
  }
}
// rounded-rect alpha mask (radiusFrac 0..0.5 of size); circle when radiusFrac>=0.5
function applyMask(img, radiusFrac) {
  const { w, h, data } = img; const r = radiusFrac >= 0.5 ? w / 2 : radiusFrac * w;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let inside = true;
    const cx = Math.min(x + 0.5, w - x - 0.5), cy = Math.min(y + 0.5, h - y - 0.5);
    if (cx < r && cy < r) { const dx = r - cx, dy = r - cy; if (dx * dx + dy * dy > r * r) inside = false; }
    if (!inside) data[(y * w + x) * 4 + 3] = 0;
  }
  return img;
}
// place cropped mark centered into a canvas; fill = fraction of canvas the mark's LARGER side occupies
function markOn(size, bgRGBA, fill, mark, maskFrac) {
  const canvas = blank(size, bgRGBA);
  const scale = (fill * size) / Math.max(mark.w, mark.h);
  const mw = Math.max(1, Math.round(mark.w * scale)), mh = Math.max(1, Math.round(mark.h * scale));
  const m = resize(mark, mw, mh);
  composite(canvas, m, Math.round((size - mw) / 2), Math.round((size - mh) / 2));
  if (maskFrac != null) applyMask(canvas, maskFrac);
  return canvas;
}
function toRGB(img, bg = [255, 255, 255]) { // flatten alpha for RGB-only outputs (splash)
  const { w, h, data } = img; const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255;
    out[i * 3] = Math.round(data[i * 4] * a + bg[0] * (1 - a));
    out[i * 3 + 1] = Math.round(data[i * 4 + 1] * a + bg[1] * (1 - a));
    out[i * 3 + 2] = Math.round(data[i * 4 + 2] * a + bg[2] * (1 - a));
  }
  return { w, h, data: out };
}
function encodePNG_RGB({ w, h, data }) { // colorType 2
  const stride = w * 3; const filt = Buffer.alloc(h * (stride + 1));
  const paeth = (a, b, c) => { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    let best = null, bt = 0, bs = Infinity;
    for (let ft = 0; ft < 5; ft++) {
      const row = Buffer.alloc(stride); let sc = 0;
      for (let x = 0; x < stride; x++) {
        const cur = data[y * stride + x], a = x >= 3 ? data[y * stride + x - 3] : 0, u = y > 0 ? data[(y - 1) * stride + x] : 0, c = (x >= 3 && y > 0) ? data[(y - 1) * stride + x - 3] : 0;
        let v; if (ft === 0) v = cur; else if (ft === 1) v = cur - a; else if (ft === 2) v = cur - u; else if (ft === 3) v = cur - ((a + u) >> 1); else v = cur - paeth(a, u, c);
        v &= 255; row[x] = v; sc += v < 128 ? v : 256 - v;
      }
      if (sc < bs) { bs = sc; bt = ft; best = row; }
    }
    filt[y * (stride + 1)] = bt; best.copy(filt, y * (stride + 1) + 1);
  }
  const comp = zlib.deflateSync(filt, { level: 9 });
  const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const b = Buffer.alloc(8 + d.length + 4); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'ascii'); d.copy(b, 8); b.writeUInt32BE(crc32(b.slice(4, 8 + d.length)), 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
}
// ICO with PNG payloads
function encodeICO(pngs /* [{size,buf}] */) {
  const n = pngs.length;
  const header = Buffer.alloc(6 + 16 * n);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(n, 4);
  let offset = 6 + 16 * n; const bodies = [];
  pngs.forEach((p, i) => {
    const e = 6 + i * 16;
    header[e] = p.size >= 256 ? 0 : p.size;
    header[e + 1] = p.size >= 256 ? 0 : p.size;
    header[e + 2] = 0; header[e + 3] = 0;
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(p.buf.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += p.buf.length; bodies.push(p.buf);
  });
  return Buffer.concat([header, ...bodies]);
}

// ---------- run ----------
const WHITE = [255, 255, 255, 255];
const src = decodePNG(fs.readFileSync(SRC));
const mark = cropToContent(src);
console.log('plogo content', mark.w + 'x' + mark.h);

const W = (rel, buf) => { const abs = path.join(ROOT, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, buf); console.log('  ' + rel + '  (' + (buf.length / 1024).toFixed(1) + 'KB)'); };

// <ProfolioLogo variant="icon"> asset — trimmed + downscaled, transparent.
{
  const dh = 256, dw = Math.round(mark.w * dh / mark.h);
  W('src/assets/logo/profolio-icon.png', encodePNG(resize(mark, dw, dh)));
}

// favicons: P on white, subtle radius
const fav16 = markOn(16, WHITE, 0.80, mark, 0);
const fav32 = markOn(32, WHITE, 0.78, mark, 0.16);
const fav48 = markOn(48, WHITE, 0.78, mark, 0.18);
W('public/favicon-16.png', encodePNG(fav16));
W('public/favicon-32.png', encodePNG(fav32));
W('public/favicon-48.png', encodePNG(fav48));
W('public/favicon.ico', encodeICO([
  { size: 16, buf: encodePNG(fav16) },
  { size: 32, buf: encodePNG(fav32) },
  { size: 48, buf: encodePNG(fav48) },
]));

// apple-touch — opaque white, Apple applies its own mask
W('public/apple-touch-icon.png', encodePNG(markOn(180, WHITE, 0.72, mark, 0)));

// PWA "any" — white, rounded
W('public/pwa-192.png', encodePNG(markOn(192, WHITE, 0.72, mark, 0.18)));
W('public/pwa-512.png', encodePNG(markOn(512, WHITE, 0.72, mark, 0.18)));

// PWA maskable — full-bleed white, P inside 80% safe circle
W('public/pwa-maskable-192.png', encodePNG(markOn(192, WHITE, 0.56, mark, null)));
W('public/pwa-maskable-512.png', encodePNG(markOn(512, WHITE, 0.56, mark, null)));

// Android legacy launcher (pre-26) — white rounded square + white circle
const dpi = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, s] of Object.entries(dpi)) {
  W(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, encodePNG(markOn(s, WHITE, 0.74, mark, 0.18)));
  W(`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, encodePNG(markOn(s, WHITE, 0.70, mark, 0.5)));
}
// Android adaptive foreground — transparent, P within 66dp safe circle of the 108dp canvas
const fg = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [d, s] of Object.entries(fg)) {
  W(`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, encodePNG(markOn(s, [0, 0, 0, 0], 0.60, mark, null)));
}

// Android splash — white bg, centred P (RGB, exact existing dims)
const splashDims = {
  'drawable': [480, 320],
  'drawable-land-mdpi': [480, 320], 'drawable-land-hdpi': [800, 480], 'drawable-land-xhdpi': [1280, 720], 'drawable-land-xxhdpi': [1600, 960], 'drawable-land-xxxhdpi': [1920, 1280],
  'drawable-port-mdpi': [320, 480], 'drawable-port-hdpi': [480, 800], 'drawable-port-xhdpi': [720, 1280], 'drawable-port-xxhdpi': [960, 1600], 'drawable-port-xxxhdpi': [1280, 1920],
};
for (const [dir, [w, h]] of Object.entries(splashDims)) {
  const canvas = blank(Math.max(w, h), WHITE); // build square then crop — reuse blank(size)
  // custom: build a w×h white canvas
  const cv = { w, h, data: Buffer.alloc(w * h * 4) };
  for (let i = 0; i < w * h; i++) { cv.data[i * 4] = 255; cv.data[i * 4 + 1] = 255; cv.data[i * 4 + 2] = 255; cv.data[i * 4 + 3] = 255; }
  const target = Math.round(Math.min(w, h) * 0.28);
  const scale = target / Math.max(mark.w, mark.h);
  const mw = Math.max(1, Math.round(mark.w * scale)), mh = Math.max(1, Math.round(mark.h * scale));
  const m = resize(mark, mw, mh);
  composite(cv, m, Math.round((w - mw) / 2), Math.round((h - mh) / 2));
  W(`android/app/src/main/res/${dir}/splash.png`, encodePNG_RGB(toRGB(cv)));
}

console.log('done.');
