// Writes the maze's gem sprite: a 64x64 RGBA PNG of a cyan diamond on a transparent
// background, with a lighter top-left facet. Run with DevEco's Node (no packages):
// node tools/make_gem.js apps/maze/entry/src/main/js/MainAbility/common/gem.png
const fs = require('fs');
const zlib = require('zlib');

const SIZE = 64;
const out = process.argv[2];
if (!out) {
    console.error('Usage: node tools/make_gem.js <out.png>');
    process.exit(1);
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
const c = (SIZE - 1) / 2;
for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    for (let x = 0; x < SIZE; x++) {
        const dx = (x - c) / c;
        const dy = (y - c) / c;
        // Diamond: |dx| * 0.8 + |dy| <= 1, a little narrower than tall.
        const edge = Math.abs(dx) / 0.8 + Math.abs(dy);
        let rgba = [0, 0, 0, 0];
        if (edge <= 1) {
            if (edge > 0.88) {
                rgba = [20, 90, 120, 255];
            } else if (dx < 0 && dy < 0) {
                rgba = [190, 250, 255, 255];
            } else if (dx >= 0 && dy < 0) {
                rgba = [80, 210, 240, 255];
            } else if (dx < 0) {
                rgba = [40, 160, 210, 255];
            } else {
                rgba = [25, 120, 180, 255];
            }
        }
        const i = y * (SIZE * 4 + 1) + 1 + x * 4;
        raw[i] = rgba[0];
        raw[i + 1] = rgba[1];
        raw[i + 2] = rgba[2];
        raw[i + 3] = rgba[3];
    }
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
    let k = n;
    for (let j = 0; j < 8; j++) {
        k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
    }
    crcTable.push(k >>> 0);
}
function crc32(buf) {
    let crc = 0xffffffff;
    for (const b of buf) {
        crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
]));
