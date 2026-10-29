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
// Canvas tests wait for the canvas element to exist before asking for its context.
const CANVAS_WAIT_MS = 50;
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

// Squares in a grid filling the 466 px screen, as plain data for both canvas and divs.
function grid(n, shift) {
    const cols = Math.ceil(Math.sqrt(n));
    const size = Math.floor(466 / cols);
    const cells = [];
    for (let i = 0; i < n; i++) {
        cells.push({
            x: (i % cols) * size,
            y: Math.floor(i / cols) * size,
            s: size - 1,
            c: PALETTE[(i * 7 + (shift || 0)) % PALETTE.length]
        });
    }
    return cells;
}

function decode(text) {
    const results = {};
    if (text) {
        text.split('|').forEach((pair) => {
            const at = pair.indexOf('=');
            if (at > 0) {
                results[pair.slice(0, at)] = pair.slice(at + 1);
            }
        });
    }
    return results;
}

function encode(results) {
    return Object.keys(results).map((id) => id + '=' + results[id]).join('|');
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
    results: {},
    timer: null,
    onInit() {
        this.frames = THEMES.map((id) => ({ src: '/common/themes/' + id + '_small.png' }));
        this.datasets = [{ strokeColor: '#46f0f0', fillColor: '#4363d8', data: [10, 40, 25, 70, 55, 90, 30, 60], gradient: true }];
        this.chartOptions = { xAxis: { min: 0, max: 7, display: false }, yAxis: { min: 0, max: 100, display: false }, series: { lineStyle: { width: 4 } } };
        storage.get({
            key: RESULTS_KEY,
            default: '',
            success: (text) => {
                this.results = decode(text);
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
        this.tests = TESTS.map((t, i) => ({ index: i, name: t.name, result: this.results[t.id] || '-' }));
    },
    save(id, result) {
        this.results[id] = result;
        storage.set({ key: RESULTS_KEY, value: encode(this.results) });
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
        clearTimeout(this.timer);
        clearInterval(this.timer);
        this.running = '';
        this.view = '';
        this.cells = [];
        this.showList();
    },
    toGame() {
        router.replace({ uri: 'pages/index/index' });
    },
    // Runs draw once the canvas exists; times the calls and, through a 0 ms timeout, the
    // frame that shows them.
    withCanvas(draw) {
        this.timer = setTimeout(() => {
            try {
                const ctx = this.$refs.cv.getContext('2d');
                const t0 = Date.now();
                draw(ctx);
                const js = Date.now() - t0;
                this.timer = setTimeout(() => this.finish('js ' + js + ' / all ' + (Date.now() - t0) + ' ms'), 0);
            } catch (e) {
                this.finish('error ' + e);
            }
        }, CANVAS_WAIT_MS);
    },
    canvasGrid(n) {
        this.withCanvas((ctx) => {
            grid(n).forEach((cell) => {
                ctx.fillStyle = cell.c;
                ctx.fillRect(cell.x, cell.y, cell.s, cell.s);
            });
        });
    },
    // Calls step(i) for FRAMES frames, each after the previous one is shown, and reports the
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
            this.timer = setTimeout(next, 0);
        };
        next();
    },
    showCells(n) {
        const cells = grid(n);
        const t0 = Date.now();
        this.cells = cells;
        this.timer = setTimeout(() => this.finish('all ' + (Date.now() - t0) + ' ms'), 0);
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
    c6() {
        this.timer = setTimeout(() => {
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
        this.timer = setTimeout(() => {
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
                this.timer = setTimeout(next, 0);
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
        this.timer = setInterval(() => {
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
