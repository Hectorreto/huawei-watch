import storage from '@system.storage';
import router from '@system.router';
import brightness from '@system.brightness';
import file from '@system.file';
// Empty in the Previewer, which has no audio module; on the watch it exists but drops every
// src tried so far (see "Tap sound" in docs/create-and-preview-the-app.md).
import audio from '@system.audio';

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
// Audio scan, phase 1: every file extension of 1-3 lowercase letters or digits and of 4
// letters is given to audio.src (no file needed) to see whether any is kept. The work is
// done in slices of AUDIO_SLICE_MS every AUDIO_TICK_MS, so JS never blocks for long.
const EXT_SHORT = 'abcdefghijklmnopqrstuvwxyz0123456789';
const EXT_LONG = 'abcdefghijklmnopqrstuvwxyz';
const EXT_TOTAL = 36 + 36 * 36 + 36 * 36 * 36 + 26 * 26 * 26 * 26;
const AUDIO_SLICE_MS = 30;
const AUDIO_TICK_MS = 50;
const AUDIO_KEPT_MAX = 100;
// Phase 2: one short WAV in AUDIO_DIR is renamed to each of AUDIO_EXTS, and for each the
// lab checks whether src is kept and what play() does. A move or play that does not answer
// in time counts as no answer.
const AUDIO_DIR = 'internal://app/';
const AUDIO_EXTS = [
    'wav', 'wave', 'mp3', 'mp2', 'mpa', 'aac', 'adts', 'm4a', 'm4b', 'm4r', 'mp4', '3gp', '3ga',
    '3g2', 'amr', 'awb', 'ogg', 'oga', 'ogx', 'opus', 'spx', 'flac', 'fla', 'ape', 'wma', 'wv',
    'mka', 'webm', 'weba', 'mid', 'midi', 'rmi', 'kar', 'xmf', 'mxmf', 'imy', 'ota', 'rtttl',
    'rtx', 'smf', 'pcm', 'raw', 'au', 'snd', 'aif', 'aiff', 'aifc', 'caf', 'ac3', 'ec3', 'dts',
    'gsm', 'vox', 'sbc', 'lc3', 'ra', 'rm', 'mpc', 'tta', 'dsf', 'alac', 'm3u', 'pls', 'bin',
    'dat', 'tmp', 'txt', 'sound', 'ring', 'tone'
];
const MOVE_WAIT_MS = 3000;
const PLAY_WAIT_MS = 1500;
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
    { id: 'e6', name: 'Interval, text only', view: 'text' },
    { id: 'e7', name: 'Interval, rects', view: 'canvas', size: 466 },
    { id: 'e8', name: 'Paced 100 ms', view: 'canvas', size: 466 },
    { id: 'e9', name: 'Paced 250 ms', view: 'canvas', size: 466 },
    { id: 'h1', name: '100 divs', view: 'cells' },
    { id: 'h4', name: 'Div anim 60', view: 'mover' },
    { id: 'i1', name: 'Image swap 60', view: 'image' },
    { id: 'i2', name: 'image-animator', view: 'animator' },
    { id: 'i3', name: 'analog-clock', view: 'clock' },
    { id: 'k1', name: 'Keyframes rotate', view: 'keyframes' },
    { id: 'p1', name: 'progress + chart', view: 'charts' },
    { id: 'q1', name: 'qrcode', view: 'qrcode' },
    { id: 'a1', name: 'Audio: all extensions', view: 'audio' },
    { id: 'a2', name: 'Audio: rename a WAV', view: 'audio' }
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

// The Previewer's import is empty (no play()), and a plain object would keep any src.
function hasAudio() {
    return !!audio && typeof audio.play === 'function';
}

// Phase 1 extension number i: first all of length 1, 2 and 3 from EXT_SHORT, then length 4
// from EXT_LONG.
function extAt(i) {
    const lengths = [1, 2, 3, 4];
    for (let l = 0; l < lengths.length; l++) {
        const chars = lengths[l] === 4 ? EXT_LONG : EXT_SHORT;
        const count = Math.pow(chars.length, lengths[l]);
        if (i < count) {
            let ext = '';
            for (let k = 0; k < lengths[l]; k++) {
                ext = chars[i % chars.length] + ext;
                i = Math.floor(i / chars.length);
            }
            return ext;
        }
        i -= count;
    }
    return '';
}

// A 0.3 s 440 Hz tone as an 8-bit mono 8 kHz WAV.
function toneWav() {
    const samples = 2400;
    const bytes = new Uint8Array(44 + samples);
    const text = (at, s) => {
        for (let k = 0; k < s.length; k++) {
            bytes[at + k] = s.charCodeAt(k);
        }
    };
    const u32 = (at, v) => {
        for (let k = 0; k < 4; k++) {
            bytes[at + k] = (v >> (8 * k)) & 255;
        }
    };
    text(0, 'RIFF');
    u32(4, 36 + samples);
    text(8, 'WAVEfmt ');
    u32(16, 16);
    u32(20, 1 | (1 << 16));
    u32(24, 8000);
    u32(28, 8000);
    u32(32, 1 | (8 << 16));
    text(36, 'data');
    u32(40, samples);
    for (let k = 0; k < samples; k++) {
        bytes[44 + k] = 128 + Math.round(100 * Math.sin(2 * Math.PI * 440 * k / 8000));
    }
    return bytes;
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
        title: 'Drawing lab',
        tests: [],
        running: '',
        view: '',
        size: 0,
        status: '',
        detail: '',
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
        // Long tests ran into the screen timeout, which looked like a crash; keep it on while the
        // lab is open. The list title says so if that fails.
        try {
            brightness.setKeepScreenOn({
                keepScreenOn: true,
                fail: (data, code) => {
                    this.title = 'Screen-on failed ' + code;
                }
            });
        } catch (e) {
            this.title = 'Screen-on error';
        }
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
    // Like countText (and, withRects, like e1), but driven by one setInterval every intervalMs
    // instead of a new setTimeout per step, and showing the seconds since it started. Every
    // test that redraws every 16 ms died after 350-490 steps, with or without a canvas, text
    // updates or a new timer per step; a slower interval tells a time limit from a step limit.
    countInterval(withRects, intervalMs) {
        let steps = 0;
        let t0 = 0;
        let ctx = null;
        const step = () => {
            if (this.running === '') {
                clearInterval(timer);
                return;
            }
            if (steps >= COUNT_MAX) {
                clearInterval(timer);
                this.finish(steps + ' steps OK');
                return;
            }
            try {
                if (withRects) {
                    const cell = roundCell(steps);
                    ctx.fillStyle = PALETTE[Math.floor(steps / COUNT_COLOUR_EVERY) % PALETTE.length];
                    ctx.fillRect(cell.x, cell.y, COUNT_CELL - 1, COUNT_CELL - 1);
                }
            } catch (e) {
                clearInterval(timer);
                this.finish('error at ' + steps + ': ' + e);
                return;
            }
            steps++;
            this.status = steps + (withRects ? ' rects' : ' steps') + ', ' + Math.floor((Date.now() - t0) / 1000) + ' s';
        };
        timer = setTimeout(() => {
            if (withRects) {
                ctx = this.$refs.cv.getContext('2d');
            }
            t0 = Date.now();
            timer = setInterval(step, intervalMs);
        }, CANVAS_WAIT_MS);
    },
    e6() {
        this.countInterval(false, FRAME_MS);
    },
    e7() {
        this.countInterval(true, FRAME_MS);
    },
    e8() {
        this.countInterval(true, 100);
    },
    e9() {
        this.countInterval(true, 250);
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
    },
    // Phase 1: gives every extension to audio.src and lists those it keeps.
    a1() {
        if (!hasAudio()) {
            this.finish('no audio module');
            return;
        }
        let i = 0;
        const kept = [];
        const t0 = Date.now();
        this.detail = 'kept: none yet';
        timer = setInterval(() => {
            if (this.running === '') {
                clearInterval(timer);
                return;
            }
            const tick = Date.now();
            try {
                while (i < EXT_TOTAL && Date.now() - tick < AUDIO_SLICE_MS) {
                    for (let k = 0; k < 50 && i < EXT_TOTAL; k++, i++) {
                        const ext = extAt(i);
                        audio.src = '/common/x.' + ext;
                        if (audio.src) {
                            if (kept.length < AUDIO_KEPT_MAX) {
                                kept.push(ext);
                            }
                            audio.src = '';
                        }
                    }
                }
            } catch (e) {
                clearInterval(timer);
                this.finish('error at .' + extAt(i) + ': ' + e);
                return;
            }
            this.status = i + ' / ' + EXT_TOTAL + ', ' + Math.floor((Date.now() - t0) / 1000) + ' s';
            if (kept.length > 0) {
                this.detail = 'kept: ' + kept.join(' ');
            }
            if (i >= EXT_TOTAL) {
                clearInterval(timer);
                this.finish(kept.length + ' kept');
            }
        }, AUDIO_TICK_MS);
    },
    // Phase 2: writes one WAV, then for each of AUDIO_EXTS renames it, sets src and plays it.
    // Each outcome is "kept" or "dropped" (src read back) plus what play() did: "error"
    // (onerror), "play" (onplay), "throw" or "silent" (nothing within PLAY_WAIT_MS).
    a2() {
        if (!hasAudio()) {
            this.finish('no audio module');
            return;
        }
        let i = 0;
        let current = AUDIO_DIR + 'tone.wav';
        const counts = {};
        const odd = [];
        const next = () => {
            if (this.running === '') {
                return;
            }
            if (i >= AUDIO_EXTS.length) {
                this.finish(Object.keys(counts).map((k) => counts[k] + ' ' + k).join(', '));
                return;
            }
            const ext = AUDIO_EXTS[i];
            const target = AUDIO_DIR + 'tone.' + ext;
            this.status = (i + 1) + ' / ' + AUDIO_EXTS.length + ' .' + ext;
            if (target === current) {
                tryPlay(ext);
                return;
            }
            let answered = false;
            timer = setTimeout(() => {
                if (!answered) {
                    answered = true;
                    this.finish('move did not answer at .' + ext);
                }
            }, MOVE_WAIT_MS);
            file.move({
                srcUri: current,
                dstUri: target,
                success: () => {
                    if (answered) {
                        return;
                    }
                    answered = true;
                    clearTimeout(timer);
                    current = target;
                    tryPlay(ext);
                },
                fail: (data, code) => {
                    if (answered) {
                        return;
                    }
                    answered = true;
                    clearTimeout(timer);
                    this.finish('move failed at .' + ext + ': ' + code);
                }
            });
        };
        const tryPlay = (ext) => {
            audio.src = current;
            const src = audio.src ? 'kept' : 'dropped';
            let done = false;
            const result = (what) => {
                if (done) {
                    return;
                }
                done = true;
                clearTimeout(timer);
                try {
                    audio.stop();
                } catch (e) {
                    // Nothing was playing.
                }
                const outcome = src + ' ' + what;
                counts[outcome] = (counts[outcome] || 0) + 1;
                if (outcome !== 'dropped error') {
                    odd.push(ext + ': ' + outcome);
                }
                this.detail = odd.length > 0 ? odd.join('\n') : 'all dropped + error so far';
                i++;
                timer = setTimeout(next, 0);
            };
            audio.onplay = () => result('play');
            audio.onerror = () => result('error');
            timer = setTimeout(() => result('silent'), PLAY_WAIT_MS);
            try {
                audio.play();
            } catch (e) {
                result('throw');
            }
        };
        this.detail = 'writing the WAV...';
        file.writeArrayBuffer({
            uri: current,
            buffer: toneWav(),
            success: () => next(),
            fail: (data, code) => this.finish('write failed: ' + code)
        });
    }
};
