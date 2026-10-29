import storage from '@system.storage';
import router from '@system.router';

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
// Counting tests: one COUNT_CELL px square per step inside the round screen, the colour
// changing every COUNT_COLOUR_EVERY squares, with the count on screen so the watch itself
// shows how far it got. They stop on their own at COUNT_MAX.
const COUNT_CELL = 10;
const COUNT_COLOUR_EVERY = 100;
const COUNT_MAX = 5000;
// The recreate test removes the canvas and makes a new one every RECREATE_EVERY squares,
// well under the 362 that one square per step reached on the watch.
const RECREATE_EVERY = 100;
const PALETTE = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
    '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3'
];
const THEMES = ['classic', 'cookie', 'donut', 'concha', 'gingerbread', 'cinnamon', 'skull', 'rosca', 'bunuelo', 'pan_de_muerto'];

// view: which block of index.hml shows the test. Comparable pairs: c3/h1 (100 squares) and
// c6/h4 (moving square). Tests that rebooted the watch (more canvas rects, more divs, the
// concha as rects) were removed so they are not run again by mistake; see
// docs/compare-drawing-methods.md.
const TESTS = [
    { id: 'c1', name: 'Canvas 100px 1 rect', view: 'canvas', size: 100 },
    { id: 'c2', name: 'Canvas 466px 1 rect', view: 'canvas', size: 466 },
    { id: 'c3', name: 'Canvas 100 rects', view: 'canvas', size: 466 },
    { id: 'c4', name: 'Canvas 1000 rects', view: 'canvas', size: 466 },
    { id: 'c6', name: 'Canvas anim 60', view: 'canvas', size: 200 },
    { id: 'c7', name: 'Canvas arcs+text', view: 'canvas', size: 466 },
    { id: 'e1', name: 'Count rects', view: 'canvas', size: 466 },
    { id: 'e2', name: 'Count, new canvas', view: 'canvas', size: 466 },
    { id: 'e3', name: 'Count, 10 per step', view: 'canvas', size: 466 },
    { id: 'e4', name: 'Count, text only', view: 'text' },
    { id: 'e5', name: 'Count, text every 50', view: 'canvas', size: 466 },
    { id: 'h1', name: '100 divs', view: 'cells' },
    { id: 'h4', name: 'Div anim 60', view: 'mover' },
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

// Top-left corners of the COUNT_CELL grid cells whose centre is on the round screen, row by
// row; filled on first use.
let roundCells = null;

function roundCell(k) {
    if (!roundCells) {
        roundCells = [];
        const cols = Math.floor(466 / COUNT_CELL);
        for (let i = 0; i < cols * cols; i++) {
            const x = (i % cols) * COUNT_CELL;
            const y = Math.floor(i / cols) * COUNT_CELL;
            const dx = x + COUNT_CELL / 2 - 233;
            const dy = y + COUNT_CELL / 2 - 233;
            if (dx * dx + dy * dy < 225 * 225) {
                roundCells.push(i);
            }
        }
    }
    const cols = Math.floor(466 / COUNT_CELL);
    const i = roundCells[k % roundCells.length];
    return { x: (i % cols) * COUNT_CELL, y: Math.floor(i / cols) * COUNT_CELL };
}

function drawCell(ctx, i, n) {
    const cell = gridCell(i, n);
    ctx.fillStyle = cell.c;
    ctx.fillRect(cell.x, cell.y, cell.s, cell.s);
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
    // Draws perStep squares every FRAME_MS on a full-screen canvas, showing the count, until
    // COUNT_MAX or until the watch fails. With recreateEvery > 0 (a multiple of perStep) the
    // canvas is removed and a new one made every that many squares, to see whether that
    // resets the limit. One square per step failed at 362, while 1,000 in one step worked.
    // The count is shown every statusEvery steps.
    countRects(recreateEvery, perStep, statusEvery) {
        let drawn = 0;
        let steps = 0;
        let canvases = 1;
        let ctx = null;
        const step = () => {
            if (this.running === '') {
                return;
            }
            if (drawn >= COUNT_MAX) {
                this.finish(drawn + ' rects OK');
                return;
            }
            try {
                for (let k = 0; k < perStep; k++) {
                    const cell = roundCell(drawn);
                    ctx.fillStyle = PALETTE[Math.floor(drawn / COUNT_COLOUR_EVERY) % PALETTE.length];
                    ctx.fillRect(cell.x, cell.y, COUNT_CELL - 1, COUNT_CELL - 1);
                    drawn++;
                }
            } catch (e) {
                this.finish('error at ' + drawn + ': ' + e);
                return;
            }
            steps++;
            if (steps % statusEvery === 0) {
                this.status = drawn + ' rects' + (perStep > 1 ? ', ' + steps + ' steps' : '') +
                    (recreateEvery > 0 ? ', canvas ' + canvases : '');
            }
            if (recreateEvery > 0 && drawn % recreateEvery === 0) {
                canvases++;
                this.size = 0;
                timer = setTimeout(() => {
                    this.size = 466;
                    timer = setTimeout(begin, CANVAS_WAIT_MS);
                }, CANVAS_WAIT_MS);
            } else {
                timer = setTimeout(step, FRAME_MS);
            }
        };
        const begin = () => {
            ctx = this.$refs.cv.getContext('2d');
            step();
        };
        timer = setTimeout(begin, CANVAS_WAIT_MS);
    },
    // No canvas: only the count text changes every FRAME_MS, to see whether the steps
    // themselves (a bound text update and a timer each) are what runs out.
    countText() {
        let steps = 0;
        const step = () => {
            if (this.running === '') {
                return;
            }
            if (steps >= COUNT_MAX) {
                this.finish(steps + ' steps OK');
                return;
            }
            steps++;
            this.status = steps + ' steps, no canvas';
            timer = setTimeout(step, FRAME_MS);
        };
        step();
    },
    e1() {
        this.countRects(0, 1, 1);
    },
    e2() {
        this.countRects(RECREATE_EVERY, 1, 1);
    },
    e3() {
        this.countRects(0, 10, 1);
    },
    e4() {
        this.countText();
    },
    e5() {
        this.countRects(0, 1, 50);
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
    h4() {
        this.animate((i) => {
            this.moverX = 133 + (i * 3) % 160;
        });
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
