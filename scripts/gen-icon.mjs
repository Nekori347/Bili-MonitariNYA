// Generates a 1024x1024 app icon (rounded pink square with a white "B").
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZE = 1024;
const PINK = [251, 114, 153]; // bilibili pink
const radius = 220;

function inRoundedRect(x, y) {
  const r = radius;
  const minX = r, minY = r, maxX = SIZE - r, maxY = SIZE - r;
  const cx = Math.min(Math.max(x, minX), maxX);
  const cy = Math.min(Math.max(y, minY), maxY);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// crude "B" glyph mask
function inB(x, y) {
  const left = 330, top = 300, right = 640, bottom = 724;
  if (x < left || x > right || y < top || y > bottom) return false;
  const stemW = 72;
  if (x < left + stemW) return true;
  const midY = (top + bottom) / 2;
  const holeCX = right - 110;
  const topR = 100, botR = 100;
  const topC = [holeCX, top + 110];
  const botC = [holeCX, bottom - 110];
  const dTop = (x - topC[0]) ** 2 + (y - topC[1]) ** 2;
  const dBot = (x - botC[0]) ** 2 + (y - botC[1]) ** 2;
  if (dTop <= topR * topR) return false;
  if (dBot <= botR * botR) return false;
  // outer lobes
  const outerTop = (x - holeCX) ** 2 + (y - (top + 110)) ** 2;
  const outerBot = (x - holeCX) ** 2 + (y - (bottom - 110)) ** 2;
  if (outerTop <= 200 * 200 || outerBot <= 200 * 200) return true;
  if (y > top + 90 && y < bottom - 90) {
    // straight section bridging lobes
    return true;
  }
  if (Math.abs(y - midY) < 40) return false;
  return y >= top + 110 && y <= bottom - 110;
}

const raw = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    let r = 0, g = 0, b = 0, a = 0;
    if (inRoundedRect(x, y)) {
      r = PINK[0]; g = PINK[1]; b = PINK[2]; a = 255;
      if (inB(x, y)) { r = 255; g = 255; b = 255; }
    }
    raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
  }
}

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// PNG scanlines with filter byte 0
const stride = SIZE * 4;
const idat = Buffer.alloc((stride + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  idat[y * (stride + 1)] = 0;
  raw.copy(idat, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(idat, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = join(__dirname, "..", "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "icon.png"), png);
console.log("icon written:", join(outDir, "icon.png"));
