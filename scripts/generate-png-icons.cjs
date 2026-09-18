const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(width, height, isMaskable = false) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data: filter byte (0) + width * 4 bytes per scanline
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(rowLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = width * 0.42;
  const rInner = width * 0.32;

  // Colors
  const bgR = 0x6B, bgG = 0x70, bgB = 0x5C; // #6B705C
  const circleR = 0x5A, circleG = 0x5F, circleB = 0x4E; // #5A5F4E
  const bookR = 0xFA, bookG = 0xF8, bookB = 0xF5; // #FAF8F5
  const goldR = 0xDD, goldG = 0xBE, goldB = 0xA9; // #DDBEA9

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = bgR, g = bgG, b = bgB, a = 255;

      if (!isMaskable) {
        // Rounded corners for regular icon
        const cornerR = width * 0.22;
        const cornerDistX = Math.max(0, Math.abs(dx) - (cx - cornerR));
        const cornerDistY = Math.max(0, Math.abs(dy) - (cy - cornerR));
        if (Math.sqrt(cornerDistX * cornerDistX + cornerDistY * cornerDistY) > cornerR) {
          a = 0;
        }
      }

      if (a > 0) {
        if (dist <= rInner) {
          // Inside central circle
          r = circleR; g = circleG; b = circleB;

          // Simple Book glyph shape
          const inBook = (Math.abs(dx) < rInner * 0.65) && (dy > -rInner * 0.2) && (dy < rInner * 0.6);
          if (inBook) {
            r = bookR; g = bookG; b = bookB;
          }
          // Center book spine
          if (Math.abs(dx) < width * 0.015 && dy > -rInner * 0.2 && dy < rInner * 0.6) {
            r = bgR; g = bgG; b = bgB;
          }
          // Spark star on top
          const inSpark = (Math.abs(dx) + Math.abs(dy + rInner * 0.45)) < (width * 0.08);
          if (inSpark) {
            r = goldR; g = goldG; b = goldB;
          }
        } else if (dist <= rOuter) {
          r = bgR; g = bgG; b = bgB;
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const idatChunk = makeChunk('IDAT', zlib.deflateSync(rawData));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), generatePng(48, 48, false));

console.log('Successfully generated all compliant PWA PNG and ICO icons in /public!');
