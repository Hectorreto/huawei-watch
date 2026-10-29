// Turns a theme cookie into canvas rects for the drawing lab (pages/index/concha*.js).
// The 466 px theme PNGs are pixel art scaled up with nearest neighbour from about 94 px, so
// this finds that grid, reads one colour per art pixel, reduces the colours to a small
// palette and writes the art as rects in one of four ways: one rect per pixel, one per horizontal run of
// equal pixels, runs merged downwards into rectangles, or a row of the main colour with the rest over it.
// Usage: node tools/make_concha_rects.js <theme.png> <out.js> <colours> <pixels|runs|rects|layered>
// Runs with DevEco's Node (tools/node/node.exe); needs no packages.
const fs = require('fs');
const zlib = require('zlib');

function readPng(path) {
    const buf = fs.readFileSync(path);
    let pos = 8;
    let width = 0;
    let height = 0;
    let colourType = 0;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            if (data[8] !== 8 || data[12] !== 0) {
                throw new Error('only 8-bit, non-interlaced PNGs');
            }
            colourType = data[9];
        } else if (type === 'IDAT') {
            idat.push(data);
        }
        pos += 12 + len;
    }
    const bpp = { 2: 3, 6: 4 }[colourType];
    if (!bpp) {
        throw new Error('only RGB or RGBA PNGs, got colour type ' + colourType);
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * bpp;
    const out = Buffer.alloc(width * height * 4);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? line[i - bpp] : 0;
            const b = prev[i];
            const c = i >= bpp ? prev[i - bpp] : 0;
            let add = 0;
            if (filter === 1) {
                add = a;
            } else if (filter === 2) {
                add = b;
            } else if (filter === 3) {
                add = (a + b) >> 1;
            } else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a);
                const pb = Math.abs(p - b);
                const pc = Math.abs(p - c);
                add = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
            }
            line[i] = (line[i] + add) & 255;
        }
        for (let x = 0; x < width; x++) {
            const o = (y * width + x) * 4;
            out[o] = line[x * bpp];
            out[o + 1] = line[x * bpp + 1];
            out[o + 2] = line[x * bpp + 2];
            out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
        }
        prev = line;
    }
    return { width, height, rgba: out };
}

// Picks the art size whose nearest-neighbour upscale best matches the image.
function findGrid(img) {
    let best = null;
    for (let n = 60; n <= 140; n++) {
        let error = 0;
        for (let y = 0; y < img.height; y += 3) {
            for (let x = 0; x < img.width; x += 3) {
                const sx = Math.floor((Math.floor(x * n / img.width) + 0.5) * img.width / n);
                const sy = Math.floor((Math.floor(y * n / img.height) + 0.5) * img.height / n);
                const a = (y * img.width + x) * 4;
                const b = (sy * img.width + sx) * 4;
                for (let k = 0; k < 4; k++) {
                    error += Math.abs(img.rgba[a + k] - img.rgba[b + k]);
                }
            }
        }
        if (!best || error < best.error) {
            best = { n, error };
        }
    }
    return best.n;
}

// Median cut over the opaque art pixels; returns the palette as [r, g, b] lists.
function medianCut(pixels, count) {
    let boxes = [pixels];
    while (boxes.length < count) {
        let pick = -1;
        let pickRange = 0;
        let pickChannel = 0;
        boxes.forEach((box, i) => {
            for (let c = 0; c < 3; c++) {
                let lo = 255;
                let hi = 0;
                box.forEach((p) => {
                    lo = Math.min(lo, p[c]);
                    hi = Math.max(hi, p[c]);
                });
                if (box.length > 1 && hi - lo > pickRange) {
                    pick = i;
                    pickRange = hi - lo;
                    pickChannel = c;
                }
            }
        });
        if (pick < 0) {
            break;
        }
        const box = boxes[pick].slice().sort((p, q) => p[pickChannel] - q[pickChannel]);
        const half = box.length >> 1;
        boxes.splice(pick, 1, box.slice(0, half), box.slice(half));
    }
    return boxes.map((box) => [0, 1, 2].map((c) => Math.round(box.reduce((s, p) => s + p[c], 0) / box.length)));
}

function hex(rgb) {
    return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const [, , src, dest, colourArg, mode] = process.argv;
const colours = Number(colourArg);
const img = readPng(src);
const n = findGrid(img);
const art = [];
const opaque = [];
for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
        const sx = Math.floor((x + 0.5) * img.width / n);
        const sy = Math.floor((y + 0.5) * img.height / n);
        const o = (sy * img.width + sx) * 4;
        const p = [img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]];
        if (img.rgba[o + 3] >= 128) {
            opaque.push(p);
            art.push(p);
        } else {
            art.push(null);
        }
    }
}
const palette = medianCut(opaque, colours);
const index = art.map((p) => {
    if (!p) {
        return -1;
    }
    let best = 0;
    let bestDist = Infinity;
    palette.forEach((q, i) => {
        const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
        if (d < bestDist) {
            best = i;
            bestDist = d;
        }
    });
    return best;
});

// Each rect is five characters: x, y, width, height and colour index, each as
// String.fromCharCode(48 + value), so the page can decode it without building objects.
function encode(rects) {
    return rects.map((r) => r.map((v) => String.fromCharCode(48 + v)).join('')).join('');
}

const pixels = [];
const runs = [];
for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
        const c = index[y * n + x];
        let end = x + 1;
        while (end < n && index[y * n + end] === c) {
            end++;
        }
        if (c >= 0) {
            runs.push([x, y, end - x, 1, c]);
            for (let i = x; i < end; i++) {
                pixels.push([i, y, 1, 1, c]);
            }
        }
        x = end;
    }
}
// A run grows downwards while the row below has a run with the same span and colour.
const open = new Map();
const rects = [];
runs.forEach((r) => {
    const key = r[0] + ',' + r[2] + ',' + r[4];
    const above = open.get(key);
    if (above && above[1] + above[3] === r[1]) {
        above[3]++;
    } else {
        const rect = r.slice();
        rects.push(rect);
        open.set(key, rect);
    }
});

// Layered: each row first gets one run of the most common colour over its whole opaque
// span, then runs of every other colour are drawn over it.
const counts = palette.map(() => 0);
index.forEach((c) => {
    if (c >= 0) {
        counts[c]++;
    }
});
const base = counts.indexOf(Math.max(...counts));
const layered = [];
for (let y = 0; y < n; y++) {
    const row = index.slice(y * n, (y + 1) * n);
    const first = row.findIndex((c) => c >= 0);
    if (first < 0) {
        continue;
    }
    let last = n - 1;
    while (row[last] < 0) {
        last--;
    }
    layered.push([first, y, last - first + 1, 1, base]);
    let x = first;
    while (x <= last) {
        const c = row[x];
        let end = x + 1;
        while (end <= last && row[end] === c) {
            end++;
        }
        if (c >= 0 && c !== base) {
            layered.push([x, y, end - x, 1, c]);
        }
        x = end;
    }
}

const modes = { pixels, runs, rects, layered };
const chosen = modes[mode];
const out = [
    '// Made by tools/make_concha_rects.js from ' + src.split(/[\\/]/).pop() + ' (' + colours + ' colours, ' + mode + ').',
    '// rects: five characters per rect (x, y, width, height, colour), each String.fromCharCode(48 + value),',
    '// in art pixels of a size x size grid.',
    'export default {',
    '    size: ' + n + ',',
    '    colours: ' + JSON.stringify(palette.map(hex)) + ',',
    '    count: ' + chosen.length + ',',
    '    rects: ' + JSON.stringify(encode(chosen)),
    '};',
    ''
].join('\n');
fs.writeFileSync(dest, out);
console.log('grid ' + n + ', colours ' + palette.length + ', pixels ' + pixels.length + ', runs ' + runs.length + ', rects ' + rects.length + ', layered ' + layered.length + '; wrote ' + mode + ', ' + out.length + ' chars');
