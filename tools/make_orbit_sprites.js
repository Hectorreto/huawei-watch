// Writes the sprites of apps/orbit: a spike pointing inwards for each of SPIKE_DIRS
// directions (spike_00.png ... spike_23.png), the diamond (diamond.png), the ruby (ruby.png)
// and the shield wheel (shield.png), all small
// RGBA PNGs with 4x4 supersampled edges. Run with DevEco's Node (no packages):
// node tools/make_orbit_sprites.js apps/orbit/entry/src/main/js/MainAbility/common
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SPIKE_DIRS = 24;
const SPIKE_SIZE = 32;
const DIAMOND_SIZE = 30;
const out = process.argv[2];
if (!out) {
    console.error('Usage: node tools/make_orbit_sprites.js <common dir>');
    process.exit(1);
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
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}

// shade(x, y) returns [r, g, b] inside the shape or null outside, in pixel coordinates.
function writePng(file, size, shade) {
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) {
        raw[y * (size * 4 + 1)] = 0;
        for (let x = 0; x < size; x++) {
            let hits = 0;
            const sum = [0, 0, 0];
            for (let sy = 0; sy < 4; sy++) {
                for (let sx = 0; sx < 4; sx++) {
                    const c = shade(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4);
                    if (c) {
                        hits++;
                        sum[0] += c[0];
                        sum[1] += c[1];
                        sum[2] += c[2];
                    }
                }
            }
            const i = y * (size * 4 + 1) + 1 + x * 4;
            if (hits) {
                raw[i] = Math.round(sum[0] / hits);
                raw[i + 1] = Math.round(sum[1] / hits);
                raw[i + 2] = Math.round(sum[2] / hits);
                raw[i + 3] = Math.round(255 * hits / 16);
            }
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0))
    ]);
    fs.writeFileSync(path.join(out, file), png);
}

// A spike: a triangle with its base on the wall and its tip towards the centre. Direction k
// is the outward normal at angle k * 360 / SPIKE_DIRS, screen axes (x right, y down), so the
// page shows spike_k where the wall is at that angle. Base 24 px wide, 22 px tall.
for (let k = 0; k < SPIKE_DIRS; k++) {
    const a = k * 2 * Math.PI / SPIKE_DIRS;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const c = SPIKE_SIZE / 2;
    writePng('spike_' + String(k).padStart(2, '0') + '.png', SPIKE_SIZE, (x, y) => {
        const out = (x - c) * nx + (y - c) * ny;   // along the normal, + towards the wall
        const side = -(x - c) * ny + (y - c) * nx; // along the wall
        if (out > 11 || out < -11) {
            return null;
        }
        const half = 12 * (out + 11) / 22;
        if (Math.abs(side) > half) {
            return null;
        }
        // Lit on one face, darker on the other, so it reads as a spike.
        return side < 0 ? [255, 110, 90] : [205, 55, 50];
    });
}

// The diamond: a gold rhombus with a light upper-left facet.
writePng('diamond.png', DIAMOND_SIZE, (x, y) => {
    const c = DIAMOND_SIZE / 2;
    const dx = (x - c) / (c - 1);
    const dy = (y - c) / (c - 1);
    const edge = Math.abs(dx) / 0.8 + Math.abs(dy);
    if (edge > 1) {
        return null;
    }
    if (edge > 0.82) {
        return [150, 100, 20];
    }
    if (dy < 0) {
        return dx < 0 ? [255, 245, 170] : [255, 215, 80];
    }
    return dx < 0 ? [235, 170, 40] : [200, 135, 30];
});

// The ruby: a small red rhombus, a rarer diamond (20 px).
writePng('ruby.png', 20, (x, y) => {
    const c = 10;
    const dx = (x - c) / (c - 1);
    const dy = (y - c) / (c - 1);
    const edge = Math.abs(dx) / 0.8 + Math.abs(dy);
    if (edge > 1) {
        return null;
    }
    if (edge > 0.78) {
        return [110, 10, 25];
    }
    if (dy < 0) {
        return dx < 0 ? [255, 170, 180] : [255, 70, 90];
    }
    return dx < 0 ? [225, 35, 60] : [170, 20, 45];
});

// The shield: a green wheel with 8 teeth and a hub (28 px).
writePng('shield.png', 28, (x, y) => {
    const dx = x - 14;
    const dy = y - 14;
    const r = Math.sqrt(dx * dx + dy * dy);
    const a = Math.atan2(dy, dx);
    if (r <= 3) {
        return [210, 255, 215];
    }
    if (r >= 6.5 && r <= 9.5) {
        return [110, 232, 122];
    }
    // Spokes between the hub and the rim.
    const spoke = Math.abs(((a / (Math.PI / 2)) % 1 + 1) % 1 - 0.5);
    if (r > 3 && r < 6.5 && spoke > 0.42) {
        return [80, 190, 95];
    }
    // Teeth: triangles from the rim out to 13.5 px.
    const tooth = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) * 2;
    if (r > 9.5 && r <= 13.5 && tooth > 0.45 + 0.55 * (r - 9.5) / 4) {
        return [60, 175, 80];
    }
    return null;
});
