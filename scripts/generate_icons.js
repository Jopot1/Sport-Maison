import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Simple pure-Node PNG generator
function createPng(width, height, drawFn) {
  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel + 1; // 1 byte for filter type 0
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // CRC32 table & calculation
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw a stylish Sport Maison icon: dark background, vibrant crimson flame circle and white geometric bolt/letter
function sportMaisonDrawer(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = w * 0.44;
  const innerRadius = w * 0.38;

  // Background rounded squircle / deep dark
  const margin = w * 0.08;
  if (x < margin || x >= w - margin || y < margin || y >= h - margin) {
    return [9, 10, 15, 255]; // Deep OLED black
  }

  // Outer red accent ring
  if (dist <= radius && dist >= innerRadius) {
    return [255, 51, 75, 255]; // Vivid Crimson
  }

  // Inside circle
  if (dist < innerRadius) {
    // Dynamic lightning bolt / play triangle in the center
    const nx = (x - cx) / (w * 0.35);
    const ny = (y - cy) / (h * 0.35);

    // Diagonal dynamic slash / lightning mark
    const inSlash1 = (ny > -0.7 && ny < 0.1 && Math.abs(nx - (-ny * 0.4)) < 0.22);
    const inSlash2 = (ny >= -0.05 && ny < 0.7 && Math.abs(nx - (-ny * 0.4 + 0.15)) < 0.22);
    const inCross = (Math.abs(ny - 0.02) < 0.12 && nx > -0.35 && nx < 0.35);

    if (inSlash1 || inSlash2 || inCross) {
      return [255, 255, 255, 255]; // Pure White Emblem
    }

    // Gradient background inside ring
    const grad = Math.min(1, dist / innerRadius);
    const r = Math.round(28 * (1 - grad) + 12 * grad);
    const g = Math.round(5 * (1 - grad) + 10 * grad);
    const b = Math.round(15 * (1 - grad) + 20 * grad);
    return [r, g, b, 255];
  }

  return [14, 18, 28, 255]; // Card dark
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate icons
const sizes = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'logo.png', size: 512 }
];

for (const { name, size } of sizes) {
  const filePath = path.join(publicDir, name);
  const buf = createPng(size, size, sportMaisonDrawer);
  fs.writeFileSync(filePath, buf);
  console.log(`Generated: ${name} (${size}x${size})`);
}
