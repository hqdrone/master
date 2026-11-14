// Рисует иконки приложения (робот Болтик) в PNG без зависимостей: node scripts/make-icons.mjs
import fs from 'fs';
import zlib from 'zlib';

const PAL = ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'];
const px = Array.from({ length: 16 }, () => new Array(16).fill(-1));
const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px[j][i] = c; };
// тот же робот, что в src/ui/robot.ts
rect(7, 1, 2, 2, 6); rect(7, 0, 2, 1, 8);
rect(2, 3, 12, 9, 0); rect(3, 4, 10, 7, 6); rect(3, 4, 10, 1, 7);
rect(5, 6, 2, 2, 12); rect(9, 6, 2, 2, 12); rect(5, 6, 1, 1, 7); rect(9, 6, 1, 1, 7);
rect(6, 9, 4, 1, 5);
rect(1, 6, 1, 3, 9); rect(14, 6, 1, 3, 9);
rect(4, 12, 8, 4, 0); rect(5, 12, 6, 4, 12); rect(7, 13, 2, 2, 10);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size) {
  const cell = Math.floor((size * 0.72) / 16);
  const off = Math.floor((size - cell * 16) / 2);
  const bg = hex(PAL[1]);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - off) / cell), gy = Math.floor((y - off) / cell);
      const c = gx >= 0 && gy >= 0 && gx < 16 && gy < 16 ? px[gy][gx] : -1;
      const [r, g, b] = c >= 0 ? hex(PAL[c]) : bg;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const s of [180, 192, 512]) fs.writeFileSync(`public/icons/icon-${s}.png`, png(s));
console.log('icons ok');
