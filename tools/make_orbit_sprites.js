// Writes the sprites of apps/orbit: each group of 1 to 5 spikes along the wall, pointing
// inwards, in each of SPIKE_DIRS directions (group_<n>_<dd>.png), and the diamond
// (diamond.png), all small RGBA PNGs with 4x4 supersampled edges. Run with DevEco's Node (no
// packages): node tools/make_orbit_sprites.js apps/orbit/entry/src/main/js/MainAbility/common
// The geometry must match index.js: SPIKE_RADIUS, SPIKE_GAP and groupHalf().
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SPIKE_DIRS = 24;
const MAX_GROUP = 5;
const SPIKE_RADIUS = 213;
const SPIKE_GAP = 0.112;
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

// Half the side of a group image: the farthest spike centre from the group's centre, plus
// room for a spike (12 px half base, 11 px half height, and the inward shift of the ends).
function groupHalf(n) {
    return Math.ceil(SPIKE_RADIUS * Math.sin((n - 1) / 2 * SPIKE_GAP)) + 18;
}

// One spike: a triangle with its base on the wall and its tip towards the centre, base 24 px
// wide, 22 px tall, centred at (cx, cy) with outward normal angle a.
function spikeShade(x, y, cx, cy, a) {
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const out = (x - cx) * nx + (y - cy) * ny;   // along the normal, + towards the wall
    const side = -(x - cx) * ny + (y - cy) * nx; // along the wall
    if (out > 11 || out < -11) {
        return null;
    }
    const half = 12 * (out + 11) / 22;
    if (Math.abs(side) > half) {
        return null;
    }
    // Lit on one face, darker on the other, so it reads as a spike.
    return side < 0 ? [255, 110, 90] : [205, 55, 50];
}

// A group of n spikes centred on the wall at angle k * 360 / SPIKE_DIRS (screen axes, x right,
// y down). The image's centre is the middle of the group on the spikes' circle, so the page
// places it at SPIKE_RADIUS along the group's angle.
for (let n = 1; n <= MAX_GROUP; n++) {
    const half = groupHalf(n);
    for (let k = 0; k < SPIKE_DIRS; k++) {
        const a = k * 2 * Math.PI / SPIKE_DIRS;
        const spikes = [];
        for (let j = 0; j < n; j++) {
            const sa = a + (j - (n - 1) / 2) * SPIKE_GAP;
            spikes.push([
                half + SPIKE_RADIUS * (Math.cos(sa) - Math.cos(a)),
                half + SPIKE_RADIUS * (Math.sin(sa) - Math.sin(a)),
                sa
            ]);
        }
        writePng('group_' + n + '_' + String(k).padStart(2, '0') + '.png', half * 2, (x, y) => {
            for (const sp of spikes) {
                const c = spikeShade(x, y, sp[0], sp[1], sp[2]);
                if (c) {
                    return c;
                }
            }
            return null;
        });
    }
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
