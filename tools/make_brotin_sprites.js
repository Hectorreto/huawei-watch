// Writes Brotín's pixel art as RGBA PNGs, scaled up with nearest neighbour because the watch
// blurs what it scales. Run with DevEco's Node (no packages):
// node tools/make_brotin_sprites.js apps/brotin [preview.png]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const COLOURS = {
    '.': [0, 0, 0, 0],
    o: [28, 74, 44, 255], g: [66, 150, 76, 255], G: [36, 104, 58, 255], l: [132, 214, 112, 255],
    b: [150, 98, 56, 255], B: [92, 56, 34, 255], c: [246, 230, 196, 255], C: [176, 140, 104, 255],
    p: [244, 142, 178, 255], P: [204, 84, 136, 255], y: [255, 214, 74, 255], W: [255, 250, 220, 255],
    r: [216, 62, 58, 255], R: [140, 34, 44, 255], w: [255, 255, 255, 255], k: [24, 22, 30, 255],
    T: [158, 80, 52, 255], t: [204, 112, 70, 255], n: [34, 52, 66, 255], D: [90, 182, 244, 255]
};

// The body forms, 20 x 20. Each leaves room for a face at the row in FACE_ROW in pet.js.
const FORMS = {
    seed: [
        '....................', '....................', '....................', '....................',
        '....................', '....................', '....................',
        '..........l.........', '.........lg.........', '.......BBBBBB.......',
        '.....BBbbbbbbBB.....', '....BbbccbbbbbbB....', '...BbbccbbbbbbbbB...',
        '...BbbbbbbbbbbbbB...', '...BbbbbbbbbbbbbB...', '...BbbbbbbbbbbbbB...',
        '...BbbbbbbbbbbbbB...', '...BbbbbbbbbbbbbB...', '....BbbbbbbbbbbB....', '.....BBBBBBBBBB.....'
    ],
    sprout: [
        '....................', '....................', '....................', '....................',
        '....................', '......ll....ll......', '.....lgGl..lGgl.....', '......lgGllGgl......',
        '.........GG.........', '.......oooooo.......', '....oolllllllloo....', '...ollllllllllllo...',
        '..ollllllllllllllo..', '..ollllllllllllllo..', '..ollllllllllllllo..', '..ollllllllllllllo..',
        '..ollllllllllllllo..', '..ollllllllllllllo..', '...ollllllllllllo...', '....oooooooooooo....'
    ],
    young: [
        '...ll..........ll...', '..lgGl........lGgl..', '..lggGl......lGggl..', '...lggGl....lGggl...',
        '....lggGlGGlGggl....', '.....llllGGllll.....', '.........GG.........', '.......oGGGGo.......',
        '....oolllllllloo....', '...ollllllllllllo...', '..ollllllllllllllo..', '..ollllllllllllllo..',
        '..ollllllllllllllo..', '..ollllllllllllllo..', '..ollllllllllllllo..', '..ollllllllllllllo..',
        '..ollllllllllllllo..', '..ollllllllllllllo..', '...ollllllllllllo...', '....oooooooooooo....'
    ],
    flower: [
        '.......pppppp.......', '.....ppPPppPPpp.....', '...ppppPPppPPpppp...', '..pppppppppppppppp..',
        '.ppPPyyyyyyyyyyPPpp.', '.ppyyyyyyyyyyyyyypp.', '.ppyyyyyyyyyyyyyypp.', '.ppyyyyyyyyyyyyyypp.',
        '.ppyyyyyyyyyyyyyypp.', '.ppyyyyyyyyyyyyyypp.', '.ppPPyyyyyyyyyyPPpp.', '..pppppppppppppppp..',
        '...ppppPPppPPpppp...', '.....ppPPppPPpp.....', '.......pppGGpp......', '.........GG.........',
        '...ll....GG....ll...', '..lgGl...GG...lGgl..', '...lgGl..GG..lGgl...', '.....lgGlGGlGgl.....'
    ],
    cactus: [
        '.........pp.........', '........pyyp........', '........pppp........', '.......oooooo.......',
        '......ogllllgo......', '.....ogllllllgo.....', '....ogllllllllgo....', '.oo.ogllllllllgo.oo.',
        'olgoogllllllllgooglo', 'olgoogllllllllgooglo', 'olgoogllllllllgooglo', 'ollllgllllllllgllllo',
        '.oooogllllllllgoooo.', '....ogllllllllgo....', '....ogllllllllgo....', '....ogllllllllgo....',
        '....ogllllllllgo....', '....ogllllllllgo....', '....ogllllllllgo....', '....oooooooooooo....'
    ],
    mushroom: [
        '......RRRRRRRR......', '....RRrrrrrrrrRR....', '...RrrwwrrrrwwrrR...', '..RrrrwwrrrrwwrrrR..',
        '.RrrrrrrrrrrrrrrrrR.', '.RrrwwrrrrrrrrwwrrR.', '.RrrwwrrrrrrrrwwrrR.', 'RRrrrrrrrrrrrrrrrrRR',
        'RRRRRRRRRRRRRRRRRRRR', '....CCCCCCCCCCCC....', '....CccccccccccC....', '....CccccccccccC....',
        '....CccccccccccC....', '....CccccccccccC....', '....CccccccccccC....', '....CccccccccccC....',
        '....CccccccccccC....', '....CccccccccccC....', '....CCccccccccCC....', '.....CCCCCCCCCC.....'
    ]
};

// The faces, 10 x 4, laid over a body.
const FACES = {
    normal: ['.kk....kk.', '.kw....kw.', '..........', '....kk....'],
    blink: ['..........', '.kk....kk.', '..........', '....kk....'],
    happy: ['.kk....kk.', 'k..k..k..k', 'p...kk...p', '....kk....'],
    sad: ['k........k', '.kk....kk.', 'D...kk....', '...k..k...'],
    sleep: ['..........', 'kkk....kkk', '..........', '....kk....'],
    sick: ['k.k....k.k', '.k......k.', 'k.k....k.k', '...kkkk...']
};

const POT = [
    'TTTTTTTTTTTTTT', 'tttttttttttttt', '.TTTTTTTTTTTT.', '.TttttttttttT.',
    '.TttttttttttT.', '..TttttttttT..', '...TTTTTTTT...'
];

// The action buttons, 11 x 11, with their round chip in the art.
const BUTTONS = {
    water: [
        '...nnnnn...', '.nnnnDnnnn.', '.nnnnDnnnn.', 'nnnnDDDnnnn', 'nnnDDDDDnnn', 'nnnDWDDDnnn',
        'nnnDWDDDnnn', 'nnnnDDDnnnn', '.nnnnnnnnn.', '.nnnnnnnnn.', '...nnnnn...'
    ],
    sun: [
        '...nnnnn...', '.nnnnynnnn.', '.nynnnnnyn.', 'nnnnyyynnnn', 'nnnyyyyynnn', 'nynyyyyynyn',
        'nnnyyyyynnn', 'nnnnyyynnnn', '.nynnnnnyn.', '.nnnnynnnn.', '...nnnnn...'
    ],
    play: [
        '...nnnnn...', '.nnnnnnnnn.', '.nnppnppnn.', 'nnppppppPnn', 'nnppppppPnn', 'nnnppppPnnn',
        'nnnnppPnnnn', 'nnnnnPnnnnn', '.nnnnnnnnn.', '.nnnnnnnnn.', '...nnnnn...'
    ],
    clean: [
        '...nnnnn...', '.nnnnnnnnn.', '.nnknnnknn.', 'nnnnkkknnnn', 'nkkrrkrrkkn', 'nnnrrkrrnnn',
        'nkkrrkrrkkn', 'nnnnrkrnnnn', '.nnnnnnnnn.', '.nnnnnnnnn.', '...nnnnn...'
    ]
};

const PEST = ['.k.k.', 'rrkrr', 'rrkrr', 'rrkrr', '.rkr.'];

const SPARK = [
    '....y....', '....y....', '...yWy...', 'yyyWWWyyy', '..yWWWy..', '...yWy...', '...y.y...', '..y...y..', '.y.....y.'
];

function checkGrid(name, grid) {
    grid.forEach((row) => {
        if (row.length !== grid[0].length) {
            throw new Error(name + ': row "' + row + '" is not ' + grid[0].length + ' wide');
        }
    });
}

function canvas(width, height) {
    return { width, height, data: Buffer.alloc(width * height * 4) };
}

function paint(image, grid, left, top, scale) {
    grid.forEach((row, y) => {
        [...row].forEach((ch, x) => {
            const rgba = COLOURS[ch];
            if (!rgba) {
                throw new Error('no colour for ' + ch);
            }
            if (rgba[3] === 0) {
                return;
            }
            for (let py = 0; py < scale; py++) {
                for (let px = 0; px < scale; px++) {
                    const i = ((top + y * scale + py) * image.width + left + x * scale + px) * 4;
                    Buffer.from(rgba).copy(image.data, i);
                }
            }
        });
    });
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
function writePng(out, image) {
    const stride = image.width * 4;
    const raw = Buffer.alloc(image.height * (stride + 1));
    for (let y = 0; y < image.height; y++) {
        image.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(image.width, 0);
    ihdr.writeUInt32BE(image.height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    fs.writeFileSync(out, Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0))
    ]));
}
function sprite(out, grid, scale) {
    const image = canvas(grid[0].length * scale, grid.length * scale);
    paint(image, grid, 0, 0, scale);
    writePng(out, image);
}
function launcherIcon(out, size, scale) {
    const image = canvas(size, size);
    const margin = Math.floor((size - 20 * scale) / 2);
    paint(image, FORMS.sprout, margin, margin, scale);
    paint(image, FACES.happy, margin + 5 * scale, margin + 13 * scale, scale);
    writePng(out, image);
}

const app = process.argv[2];
if (!app) {
    console.error('Usage: node tools/make_brotin_sprites.js <app dir> [preview.png]');
    process.exit(1);
}
const all = Object.assign({}, FORMS, FACES, BUTTONS);
Object.keys(all).forEach((name) => checkGrid(name, all[name]));
checkGrid('pot', POT);
checkGrid('pest', PEST);
checkGrid('spark', SPARK);

const common = path.join(app, 'entry/src/main/js/MainAbility/common');
const media = path.join(app, 'entry/src/main/resources/base/media');
Object.keys(FORMS).forEach((name) => sprite(path.join(common, 'form_' + name + '.png'), FORMS[name], 9));
Object.keys(FACES).forEach((name) => sprite(path.join(common, 'face_' + name + '.png'), FACES[name], 9));
Object.keys(BUTTONS).forEach((name) => sprite(path.join(common, 'btn_' + name + '.png'), BUTTONS[name], 8));
sprite(path.join(common, 'pot.png'), POT, 9);
sprite(path.join(common, 'pest.png'), PEST, 8);
sprite(path.join(common, 'spark.png'), SPARK, 8);
launcherIcon(path.join(media, 'icon.png'), 104, 5);
launcherIcon(path.join(media, 'icon_small.png'), 92, 4);

// A contact sheet of the forms in their pots, to check the art without building.
if (process.argv[3]) {
    const scale = 6;
    const faceRow = { seed: 13, sprout: 13, young: 13, flower: 6, cactus: 13, mushroom: 12 };
    const faces = Object.keys(FACES);
    const sheet = canvas(3 * 21 * scale, 2 * 26 * scale);
    for (let i = 0; i < sheet.data.length; i += 4) {
        Buffer.from([18, 48, 63, 255]).copy(sheet.data, i);
    }
    Object.keys(FORMS).forEach((name, i) => {
        const left = (i % 3) * 21 * scale;
        const top = Math.floor(i / 3) * 26 * scale;
        paint(sheet, FORMS[name], left, top, scale);
        paint(sheet, FACES[faces[i]], left + 5 * scale, top + faceRow[name] * scale, scale);
        paint(sheet, POT, left + 3 * scale, top + 18 * scale, scale);
    });
    writePng(process.argv[3], sheet);
}
