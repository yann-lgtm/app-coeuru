// Génère les assets placeholder (icône, splash, favicon) de GardeAppel.
// Ces PNG ne sont pas versionnés : lancer `npm run assets` avant `expo prebuild`.
//
//   node scripts/generate-assets.js
//
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

// PNG plein d'une couleur de fond, avec un disque central (repère visuel).
function makePNG(w, h, bg, fg) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // profondeur de bit
  ihdr[9] = 2; // type couleur RVB
  const cx = w / 2,
    cy = h / 2,
    r = Math.min(w, h) * 0.28;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // octet de filtre en début de ligne
    for (let x = 0; x < w; x++) {
      const dedans = (x - cx) ** 2 + (y - cy) ** 2 < r * r;
      const c = dedans ? fg : bg;
      raw[p++] = c[0];
      raw[p++] = c[1];
      raw[p++] = c[2];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(dir, { recursive: true });

const bg = [11, 18, 32]; // #0B1220
const fg = [59, 130, 246]; // #3B82F6

fs.writeFileSync(path.join(dir, 'icon.png'), makePNG(1024, 1024, bg, fg));
fs.writeFileSync(path.join(dir, 'adaptive-icon.png'), makePNG(1024, 1024, bg, fg));
fs.writeFileSync(path.join(dir, 'splash.png'), makePNG(1284, 1284, bg, fg));
fs.writeFileSync(path.join(dir, 'favicon.png'), makePNG(48, 48, bg, fg));

console.log('Assets générés dans', dir);
