import storage from '@system.storage';
import router from '@system.router';
// The concha as canvas rects: 4 colours drawn in rows (1,962 rects) and 8 colours as merged
// rectangles (2,724 rects). Made by tools/make_concha_rects.js.
import CONCHA_4 from './concha4.js';
import CONCHA_8 from './concha8.js';

// Drawing lab: each test draws one thing with one technique and times it, so canvas,
// plain components and the other lite components can be compared on the watch.
// Before a test starts its id is saved as RUNNING_KEY and cleared when it finishes, so if
// the watch reboots or freezes, the next launch marks that test as the one that crashed.
const RESULTS_KEY = 'labResults';
const RUNNING_KEY = 'labRunning';
const CRASHED = 'CRASH / reboot';
const FRAMES = 60;
// Animations ask for a frame every FRAME_MS; a 0 ms timeout ran all 60 frames before the
// Previewer drew any. More than FRAME_MS per frame on average means drawing falls behind.
const FRAME_MS = 16;
// Canvas tests wait for the canvas element to exist before asking for its context.
const CANVAS_WAIT_MS = 50;
// Rects drawn per step by drawInParts: about 85 ms of JS on the watch (0.34 ms per fillRect).
const DRAW_PART = 250;
const PALETTE = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
    '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3'
];
const THEMES = ['classic', 'cookie', 'donut', 'concha', 'gingerbread', 'cinnamon', 'skull', 'rosca', 'bunuelo', 'pan_de_muerto'];

// view: which block of lab.hml shows the test. Comparable pairs: c3/h1 (100 squares),
// c4/h3 (1000 squares), c6/h4 (moving square).
const TESTS = [
    { id: 'c1', name: 'Canvas 100px 1 rect', view: 'canvas', size: 100 },
    { id: 'c2', name: 'Canvas 466px 1 rect', view: 'canvas', size: 466 },
    { id: 'c3', name: 'Canvas 100 rects', view: 'canvas', size: 466 },
    { id: 'c4', name: 'Canvas 1000 rects', view: 'canvas', size: 466 },
    { id: 'c5', name: 'Canvas 3500 rects', view: 'canvas', size: 466 },
    { id: 'c6', name: 'Canvas anim 60', view: 'canvas', size: 200 },
    { id: 'c7', name: 'Canvas arcs+text', view: 'canvas', size: 466 },
    { id: 'c8', name: 'Canvas 1500 rects', view: 'canvas', size: 466 },
    { id: 'c9', name: 'Canvas 2000 rects', view: 'canvas', size: 466 },
    { id: 'c10', name: 'Canvas 2500 rects', view: 'canvas', size: 466 },
    { id: 'c11', name: '3500 rects in parts', view: 'canvas', size: 466 },
    { id: 'd1', name: 'Concha 4 col', view: 'canvas', size: 466 },
    { id: 'd2', name: 'Concha 4 col parts', view: 'canvas', size: 466 },
    { id: 'd3', name: 'Concha 8 col parts', view: 'canvas', size: 466 },
    { id: 'h1', name: '100 divs', view: 'cells' },
    { id: 'h2', name: '400 divs', view: 'cells' },
    { id: 'h3', name: '1000 divs', view: 'cells' },
    { id: 'h4', name: 'Div anim 60', view: 'mover' },
    { id: 'h5', name: 'Recolor 100 x30', view: 'cells' },
    { id: 'i1', name: 'Image swap 60', view: 'image' },
    { id: 'i2', name: 'image-animator', view: 'animator' },
    { id: 'i3', name: 'analog-clock', view: 'clock' },
    { id: 'k1', name: 'Keyframes rotate', view: 'keyframes' },
    { id: 'p1', name: 'progress + chart', view: 'charts' },
    { id: 'q1', name: 'qrcode', view: 'qrcode' }
];

// Square i of n in a grid filling the 466 px screen. Canvas tests ask for one at a time,
// so they keep no array; the div tests bind the whole list.
function gridCell(i, n, shift) {
    const cols = Math.ceil(Math.sqrt(n));
    const size = Math.floor(466 / cols);
    return {
        x: (i % cols) * size,
        y: Math.floor(i / cols) * size,
        s: size - 1,
        c: PALETTE[(i * 7 + (shift || 0)) % PALETTE.length]
    };
}

function grid(n, shift) {
    const cells = [];
    for (let i = 0; i < n; i++) {
        cells.push(gridCell(i, n, shift));
    }
    return cells;
}

function drawCell(ctx, i, n) {
    const cell = gridCell(i, n);
    ctx.fillStyle = cell.c;
    ctx.fillRect(cell.x, cell.y, cell.s, cell.s);
}

// Draws rect i of a cookie from tools/make_concha_rects.js, scaled from its art grid to 466 px.
function drawArtRect(ctx, art, i) {
    const o = i * 5;
    const scale = 466 / art.size;
    const x = art.rects.charCodeAt(o) - 48;
    const y = art.rects.charCodeAt(o + 1) - 48;
    const x0 = Math.floor(x * scale);
    const y0 = Math.floor(y * scale);
    const x1 = Math.floor((x + art.rects.charCodeAt(o + 2) - 48) * scale);
    const y1 = Math.floor((y + art.rects.charCodeAt(o + 3) - 48) * scale);
    ctx.fillStyle = art.colours[art.rects.charCodeAt(o + 4) - 48];
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// Last result per test id, and the timer of the running test.
let results = {};
let timer = null;

function decode(text) {
    const parsed = {};
    if (text) {
        text.split('|').forEach((pair) => {
            const at = pair.indexOf('=');
            if (at > 0) {
                parsed[pair.slice(0, at)] = pair.slice(at + 1);
            }
        });
    }
    return parsed;
}

function encode(byId) {
    return Object.keys(byId).map((id) => id + '=' + byId[id]).join('|');
}

export default {
    data: {
        tests: [],
        running: '',
        view: '',
        size: 0,
        status: '',
        cells: [],
        moverX: 0,
        imageSrc: '',
        frames: [],
        sec: 0,
        percent: 0,
        datasets: [],
        chartOptions: {}
    },
    onInit() {
        // The list shows at once; saved results and a crash marker fill it in when storage answers.
        this.showList();
        this.frames = THEMES.map((id) => ({ src: '/common/themes/' + id + '_small.png' }));
        this.datasets = [{ strokeColor: '#46f0f0', fillColor: '#4363d8', data: [10, 40, 25, 70, 55, 90, 30, 60], gradient: true }];
        this.chartOptions = { xAxis: { min: 0, max: 7, display: false }, yAxis: { min: 0, max: 100, display: false }, series: { lineStyle: { width: 4 } } };
        storage.get({
            key: RESULTS_KEY,
            default: '',
            success: (text) => {
                results = decode(text);
                storage.get({
                    key: RUNNING_KEY,
                    default: '',
                    success: (id) => {
                        if (id) {
                            this.save(id, CRASHED);
                        }
                        this.showList();
                    },
                    fail: () => this.showList()
                });
            },
            fail: () => this.showList()
        });
    },
    showList() {
        this.tests = TESTS.map((t, i) => ({ index: i, name: t.name, result: results[t.id] || '-' }));
    },
    save(id, result) {
        results[id] = result;
        storage.set({ key: RESULTS_KEY, value: encode(results) });
        storage.set({ key: RUNNING_KEY, value: '' });
        console.info('lab ' + id + ': ' + result);
    },
    // Takes the index in TESTS: the Previewer ignores string arguments from onclick.
    run(index) {
        const test = TESTS[index];
        // The marker must be on flash before the test can crash the watch.
        storage.set({
            key: RUNNING_KEY,
            value: test.id,
            success: () => this.start(test),
            fail: () => this.start(test)
        });
    },
    start(test) {
        this.running = test.id;
        this.view = test.view;
        this.size = test.size || 0;
        this.status = 'running...';
        this[test.id]();
    },
    finish(result) {
        if (this.running === '') {
            return;
        }
        this.save(this.running, result);
        this.status = result + ' (tap)';
    },
    back() {
        clearTimeout(timer);
        clearInterval(timer);
        this.running = '';
        this.view = '';
        this.cells = [];
        this.showList();
    },
    toGame() {
        router.replace({ uri: 'pages/game/game' });
    },
    // Runs draw once the canvas exists; times the calls and, through a 0 ms timeout, the
    // frame that shows them.
    withCanvas(draw) {
        timer = setTimeout(() => {
            try {
                const ctx = this.$refs.cv.getContext('2d');
                const t0 = Date.now();
                draw(ctx);
                const js = Date.now() - t0;
                timer = setTimeout(() => this.finish('js ' + js + ' / all ' + (Date.now() - t0) + ' ms'), 0);
            } catch (e) {
                this.finish('error ' + e);
            }
        }, CANVAS_WAIT_MS);
    },
    canvasGrid(n) {
        this.withCanvas((ctx) => {
            for (let i = 0; i < n; i++) {
                drawCell(ctx, i, n);
            }
        });
    },
    // Calls drawOne(ctx, i) for count rects, DRAW_PART at a time with a 0 ms timeout in
    // between, so JS never blocks for long; tells a long draw apart from too many rects.
    drawInParts(count, drawOne) {
        timer = setTimeout(() => {
            const ctx = this.$refs.cv.getContext('2d');
            const t0 = Date.now();
            let js = 0;
            let i = 0;
            const part = () => {
                if (this.running === '') {
                    return;
                }
                const p0 = Date.now();
                const end = Math.min(i + DRAW_PART, count);
                try {
                    for (; i < end; i++) {
                        drawOne(ctx, i);
                    }
                } catch (e) {
                    this.finish('error ' + e);
                    return;
                }
                js += Date.now() - p0;
                if (i < count) {
                    timer = setTimeout(part, 0);
                } else {
                    timer = setTimeout(() => this.finish('js ' + js + ' / all ' + (Date.now() - t0) + ' ms'), 0);
                }
            };
            part();
        }, CANVAS_WAIT_MS);
    },
    // Calls step(i) for FRAMES frames, FRAME_MS apart, and reports the
    // average time per frame.
    animate(step) {
        const t0 = Date.now();
        let i = 0;
        const next = () => {
            if (this.running === '') {
                return;
            }
            if (i === FRAMES) {
                this.finish(Math.round((Date.now() - t0) / FRAMES) + ' ms/frame');
                return;
            }
            try {
                step(i);
            } catch (e) {
                this.finish('error ' + e);
                return;
            }
            i++;
            timer = setTimeout(next, FRAME_MS);
        };
        next();
    },
    showCells(n) {
        const cells = grid(n);
        const t0 = Date.now();
        this.cells = cells;
        timer = setTimeout(() => this.finish('all ' + (Date.now() - t0) + ' ms'), 0);
    },
    c1() {
        this.withCanvas((ctx) => {
            ctx.fillStyle = '#e6194b';
            ctx.fillRect(10, 10, 80, 80);
        });
    },
    c2() {
        this.withCanvas((ctx) => {
            ctx.fillStyle = '#e6194b';
            ctx.fillRect(83, 83, 300, 300);
        });
    },
    c3() {
        this.canvasGrid(100);
    },
    c4() {
        this.canvasGrid(1000);
    },
    c5() {
        this.canvasGrid(3500);
    },
    c8() {
        this.canvasGrid(1500);
    },
    c9() {
        this.canvasGrid(2000);
    },
    c10() {
        this.canvasGrid(2500);
    },
    c11() {
        this.drawInParts(3500, (ctx, i) => drawCell(ctx, i, 3500));
    },
    d1() {
        this.withCanvas((ctx) => {
            for (let i = 0; i < CONCHA_4.count; i++) {
                drawArtRect(ctx, CONCHA_4, i);
            }
        });
    },
    d2() {
        this.drawInParts(CONCHA_4.count, (ctx, i) => drawArtRect(ctx, CONCHA_4, i));
    },
    d3() {
        this.drawInParts(CONCHA_8.count, (ctx, i) => drawArtRect(ctx, CONCHA_8, i));
    },
    c6() {
        timer = setTimeout(() => {
            const ctx = this.$refs.cv.getContext('2d');
            this.animate((i) => {
                const x = (i * 3) % 160;
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 80, 200, 40);
                ctx.fillStyle = '#ffe119';
                ctx.fillRect(x, 80, 40, 40);
            });
        }, CANVAS_WAIT_MS);
    },
    c7() {
        this.withCanvas((ctx) => {
            ctx.strokeStyle = '#46f0f0';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(233, 233, 180, 0, 6.283);
            ctx.stroke();
            ctx.strokeStyle = '#f58231';
            ctx.beginPath();
            ctx.moveTo(100, 300);
            ctx.lineTo(233, 120);
            ctx.lineTo(366, 300);
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = '30px';
            ctx.textAlign = 'center';
            ctx.fillText('Canvas', 233, 360);
        });
    },
    h1() {
        this.showCells(100);
    },
    h2() {
        this.showCells(400);
    },
    h3() {
        this.showCells(1000);
    },
    h4() {
        this.animate((i) => {
            this.moverX = 133 + (i * 3) % 160;
        });
    },
    h5() {
        this.cells = grid(100);
        timer = setTimeout(() => {
            const t0 = Date.now();
            let i = 0;
            const next = () => {
                if (this.running === '') {
                    return;
                }
                if (i === 30) {
                    this.finish(Math.round((Date.now() - t0) / 30) + ' ms/frame');
                    return;
                }
                i++;
                this.cells = grid(100, i);
                timer = setTimeout(next, FRAME_MS);
            };
            next();
        }, CANVAS_WAIT_MS);
    },
    i1() {
        this.animate((i) => {
            this.imageSrc = this.frames[i % 2].src;
        });
    },
    i2() {
        this.finish('look: frames change?');
    },
    i3() {
        this.sec = 0;
        timer = setInterval(() => {
            this.sec = (this.sec + 1) % 60;
        }, 100);
        this.status = 'look: hand turns? (tap)';
        this.save(this.running, 'look');
    },
    k1() {
        this.finish('look: it turns?');
    },
    p1() {
        this.animate((i) => {
            this.percent = Math.round(i * 100 / (FRAMES - 1));
        });
    },
    q1() {
        this.finish('look: code shows?');
    }
};
