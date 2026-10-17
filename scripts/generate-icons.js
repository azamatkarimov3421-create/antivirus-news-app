// ============================================================================
// Google Play Store & PWA Icons Generator (Pure Node.js, Zero Dependencies)
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'assets', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, pixelFn) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// 7x7 Bitmap font for "A" and "N"
const GLYPH_A = [
  " 111 ",
  "1   1",
  "1   1",
  "11111",
  "1   1",
  "1   1",
  "1   1"
];

const GLYPH_N = [
  "1   1",
  "11  1",
  "1 1 1",
  "1  11",
  "1   1",
  "1   1",
  "1   1"
];

function isGlyphPixel(glyph, gx, gy) {
  if (gy < 0 || gy >= 7 || gx < 0 || gx >= 5) return false;
  return glyph[gy][gx] === '1';
}

function drawIconPixel(x, y, w, h, isMaskable) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = isMaskable ? w * 0.38 : w * 0.46; // Safe zone for maskable

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background for maskable is dark red/black brand surface
  if (isMaskable && dist > radius) {
    const bgGrad = Math.max(0, Math.min(1, y / h));
    return [Math.round(20 + 20 * bgGrad), Math.round(10 + 5 * bgGrad), Math.round(15 + 5 * bgGrad), 255];
  }

  // Outside circle for standard icon -> transparent
  if (!isMaskable && dist > radius + 1) {
    return [0, 0, 0, 0];
  }

  // Antialiasing edge
  let alphaEdge = 255;
  if (!isMaskable && dist > radius - 1) {
    alphaEdge = Math.round(Math.max(0, Math.min(255, (radius + 1 - dist) * 128)));
  }

  // 3D sphere gradient calculation
  const lightX = cx - radius * 0.35;
  const lightY = cy - radius * 0.45;
  const lightDist = Math.sqrt((x - lightX) * (x - lightX) + (y - lightY) * (y - lightY));
  const lightFactor = Math.max(0, 1 - lightDist / (radius * 1.5));

  // Base red gradient: #E50914 -> #850208
  let r = Math.round(140 + 105 * lightFactor);
  let g = Math.round(5 + 20 * lightFactor);
  let b = Math.round(15 + 20 * lightFactor);

  // Specular glossy highlight at top
  const specDist = Math.sqrt((x - (cx - radius * 0.25)) ** 2 + (y - (cy - radius * 0.35)) ** 2);
  if (specDist < radius * 0.5) {
    const spec = (1 - specDist / (radius * 0.5)) ** 2 * 0.45;
    r = Math.min(255, Math.round(r + 255 * spec));
    g = Math.min(255, Math.round(g + 180 * spec));
    b = Math.min(255, Math.round(b + 180 * spec));
  }

  // Render "AN" Monogram in Center
  // Glyph box coordinates
  const scale = (radius * 1.1) / 7;
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const gap = scale * 1.2;
  const totalW = glyphW * 2 + gap;

  const startX = cx - totalW / 2;
  const startY = cy - glyphH / 2 + scale * 0.1;

  let inText = false;

  // Check 'A'
  if (x >= startX && x < startX + glyphW && y >= startY && y < startY + glyphH) {
    const gx = Math.floor((x - startX) / scale);
    const gy = Math.floor((y - startY) / scale);
    if (isGlyphPixel(GLYPH_A, gx, gy)) inText = true;
  }

  // Check 'N'
  const startNx = startX + glyphW + gap;
  if (x >= startNx && x < startNx + glyphW && y >= startY && y < startY + glyphH) {
    const gx = Math.floor((x - startNx) / scale);
    const gy = Math.floor((y - startY) / scale);
    if (isGlyphPixel(GLYPH_N, gx, gy)) inText = true;
  }

  if (inText) {
    // Crisp white with subtle 3D bevel
    return [255, 255, 255, alphaEdge];
  }

  return [r, g, b, alphaEdge];
}

console.log('Generating Google Play & PWA Icons...');

// 1. Icon 192x192
const icon192 = createPng(192, 192, (x, y, w, h) => drawIconPixel(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);
console.log('✅ icon-192.png (192x192) created');

// 2. Icon 512x512 (Play Store requirement)
const icon512 = createPng(512, 512, (x, y, w, h) => drawIconPixel(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);
console.log('✅ icon-512.png (512x512) created');

// 3. Maskable 192x192
const maskable192 = createPng(192, 192, (x, y, w, h) => drawIconPixel(x, y, w, h, true));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192.png'), maskable192);
console.log('✅ icon-maskable-192.png (192x192) created');

// 4. Maskable 512x512
const maskable512 = createPng(512, 512, (x, y, w, h) => drawIconPixel(x, y, w, h, true));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), maskable512);
console.log('✅ icon-maskable-512.png (512x512) created');

// 5. Play Store Feature Graphic (1024x500 banner)
const featureGraphic = createPng(1024, 500, (x, y, w, h) => {
  // Dark luxury cyber background with red ambient glow
  const cx = w * 0.35;
  const cy = h / 2;
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  const glow = Math.max(0, 1 - dist / 380);

  let r = Math.round(10 + 130 * (glow ** 1.8));
  let g = Math.round(10 + 10 * glow);
  let b = Math.round(14 + 15 * glow);

  // Subtle grid lines
  if (x % 40 === 0 || y % 40 === 0) {
    r = Math.min(255, r + 15);
    g = Math.min(255, g + 8);
    b = Math.min(255, b + 10);
  }

  // Draw 3D sphere badge on the left
  const badgeRadius = 140;
  if (dist <= badgeRadius) {
    return drawIconPixel(x - (cx - badgeRadius), y - (cy - badgeRadius), badgeRadius * 2, badgeRadius * 2, false);
  }

  return [r, g, b, 255];
});
fs.writeFileSync(path.join(iconsDir, 'playstore-feature-graphic.png'), featureGraphic);
console.log('✅ playstore-feature-graphic.png (1024x500) created');

console.log('🎉 All icons successfully generated!');
