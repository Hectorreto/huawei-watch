import brightness from '@system.brightness';

// Maze prototype: a first-person view of a small maze, drawn on a canvas one step at a time.
// What the watch allows shaped it (docs/compare-drawing-methods.md): a canvas takes about
// 1,100 fillRect before the app is killed and there is no clearRect, so only the parts of
// each column that change are drawn, and the canvas is remade when it nears the limit.
const MAZE_CELLS = 9;
const GRID = 2 * MAZE_CELLS + 1;
const WALL = 1;
const EXIT = 2;
const SCREEN = 466;
const COLS = 39;
const COL_W = 12;
// Half the width of the view, in cells at distance 1: about a 66 degree field of view.
const PLANE = 0.66;
// Wall height on screen is WALL_SCALE / distance, in px.
const WALL_SCALE = 380;
// Draw calls allowed on one canvas before it is remade, under the ~1,100 that crash it.
const CANVAS_LIMIT = 900;
const CANVAS_WAIT_MS = 50;
const WIN_MS = 1500;
// North, east, south, west, as steps on the grid (y grows downwards).
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const COMPASS = ['N', 'E', 'S', 'O'];
// Touch zones on the 466 px screen.
const TURN_ZONE = 155;
const BACK_ZONE = 340;

let grid = [];
let seed = 1;
let px = 1;
let py = 1;
let facing = 1;
let steps = 0;
let ctx = null;
let onCanvas = 0;
let busy = true;
// Height and colour of each column as it is on the canvas now.
const shownH = [];
const shownColour = [];

function random() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
}

// Carves a maze with a depth-first search from the top-left cell; the exit is a door in the
// outer wall next to the bottom-right cell.
function makeMaze() {
    grid = [];
    for (let y = 0; y < GRID; y++) {
        const row = [];
        for (let x = 0; x < GRID; x++) {
            row.push(WALL);
        }
        grid.push(row);
    }
    const stack = [[1, 1]];
    grid[1][1] = 0;
    while (stack.length > 0) {
        const cur = stack[stack.length - 1];
        const options = [];
        for (let d = 0; d < 4; d++) {
            const nx = cur[0] + 2 * DIRS[d][0];
            const ny = cur[1] + 2 * DIRS[d][1];
            if (nx > 0 && ny > 0 && nx < GRID - 1 && ny < GRID - 1 && grid[ny][nx] === WALL) {
                options.push(d);
            }
        }
        if (options.length === 0) {
            stack.pop();
            continue;
        }
        const d = options[Math.floor(random() * options.length)];
        grid[cur[1] + DIRS[d][1]][cur[0] + DIRS[d][0]] = 0;
        grid[cur[1] + 2 * DIRS[d][1]][cur[0] + 2 * DIRS[d][0]] = 0;
        stack.push([cur[0] + 2 * DIRS[d][0], cur[1] + 2 * DIRS[d][1]]);
    }
    grid[GRID - 2][GRID - 1] = EXIT;
    px = 1;
    py = 1;
    facing = grid[1][2] === 0 ? 1 : 2;
    steps = 0;
}

function hex2(v) {
    return (v < 16 ? '0' : '') + v.toString(16);
}

// Wall colour by what was hit, which side (x or y faces, for some sense of depth) and
// distance, darkened in four bands so a column keeps its colour over small changes.
function wallColour(cell, side, dist) {
    const band = Math.min(3, Math.floor(dist / 2));
    const light = (side === 0 ? 1 : 0.75) * (1 - band * 0.2);
    const base = cell === EXIT ? [80, 220, 110] : [230, 160, 70];
    return '#' + base.map((v) => hex2(Math.round(v * light))).join('');
}

// Casts one ray per column from the centre of the player's cell (DDA on the grid) and
// returns each column's wall height and colour.
function castView() {
    const dx = DIRS[facing][0];
    const dy = DIRS[facing][1];
    const planeX = -dy * PLANE;
    const planeY = dx * PLANE;
    const view = [];
    for (let c = 0; c < COLS; c++) {
        const cam = 2 * (c + 0.5) / COLS - 1;
        const rx = dx + planeX * cam;
        const ry = dy + planeY * cam;
        let mx = px;
        let my = py;
        const stepX = rx < 0 ? -1 : 1;
        const stepY = ry < 0 ? -1 : 1;
        const deltaX = rx === 0 ? 1e9 : Math.abs(1 / rx);
        const deltaY = ry === 0 ? 1e9 : Math.abs(1 / ry);
        let sideX = 0.5 * deltaX;
        let sideY = 0.5 * deltaY;
        let side = 0;
        while (grid[my][mx] === 0) {
            if (sideX < sideY) {
                sideX += deltaX;
                mx += stepX;
                side = 0;
            } else {
                sideY += deltaY;
                my += stepY;
                side = 1;
            }
        }
        const dist = Math.max(0.05, side === 0 ? sideX - deltaX : sideY - deltaY);
        const h = 2 * Math.round(Math.min(SCREEN, WALL_SCALE / dist) / 2);
        view.push({ h: h, colour: wallColour(grid[my][mx], side, dist) });
    }
    return view;
}

function fill(x, top, bottom, colour) {
    if (bottom > top) {
        ctx.fillStyle = colour;
        ctx.fillRect(x, top, COL_W - 1, bottom - top);
        onCanvas++;
    }
}

export default {
    data: {
        live: false,
        hud: '',
        note: ''
    },
    onInit() {
        try {
            brightness.setKeepScreenOn({ keepScreenOn: true });
        } catch (e) {
            // The screen just turns off as usual.
        }
        seed = Date.now() & 0x7fffffff;
        makeMaze();
        this.newCanvas();
    },
    // Removes the canvas (if it exists) and makes a fresh one, then draws the whole view.
    newCanvas() {
        busy = true;
        ctx = null;
        this.live = false;
        setTimeout(() => {
            this.live = true;
            setTimeout(() => {
                ctx = this.$refs.cv.getContext('2d');
                onCanvas = 0;
                for (let c = 0; c < COLS; c++) {
                    shownH[c] = 0;
                    shownColour[c] = '';
                }
                busy = false;
                this.draw();
            }, CANVAS_WAIT_MS);
        }, CANVAS_WAIT_MS);
    },
    // Draws the view from the current cell, only where a column changed: the bands it grew
    // or lost when its colour is the same, else the whole new wall plus the bands it lost.
    draw() {
        const view = castView();
        let needed = 0;
        for (let c = 0; c < COLS; c++) {
            if (view[c].colour !== shownColour[c]) {
                needed += 3;
            } else if (view[c].h !== shownH[c]) {
                needed += 2;
            }
        }
        if (onCanvas + needed > CANVAS_LIMIT) {
            this.newCanvas();
            return;
        }
        for (let c = 0; c < COLS; c++) {
            const x = c * COL_W;
            const h = view[c].h;
            const old = shownH[c];
            const mid = SCREEN / 2;
            if (view[c].colour !== shownColour[c]) {
                fill(x, mid - h / 2, mid + h / 2, view[c].colour);
            } else if (h > old) {
                fill(x, mid - h / 2, mid - old / 2, view[c].colour);
                fill(x, mid + old / 2, mid + h / 2, view[c].colour);
            }
            if (h < old) {
                fill(x, mid - old / 2, mid - h / 2, '#000000');
                fill(x, mid + h / 2, mid + old / 2, '#000000');
            }
            shownH[c] = h;
            shownColour[c] = view[c].colour;
        }
        this.hud = COMPASS[facing] + '  ' + steps;
    },
    // Left third turns left, right third turns right, the bottom turns around, the middle
    // steps forward. The click event carries the position (globalX, globalY); ontouchstart
    // on this div did not fire in the Previewer.
    tap(e) {
        if (busy) {
            return;
        }
        const touchX = e && typeof e.globalX === 'number' ? e.globalX : SCREEN / 2;
        const touchY = e && typeof e.globalY === 'number' ? e.globalY : SCREEN / 2;
        this.note = '';
        if (touchY > BACK_ZONE) {
            facing = (facing + 2) % 4;
        } else if (touchX < TURN_ZONE) {
            facing = (facing + 3) % 4;
        } else if (touchX > SCREEN - TURN_ZONE) {
            facing = (facing + 1) % 4;
        } else {
            const nx = px + DIRS[facing][0];
            const ny = py + DIRS[facing][1];
            if (grid[ny][nx] === EXIT) {
                this.win();
                return;
            }
            if (grid[ny][nx] === WALL) {
                this.note = 'Pared';
                return;
            }
            px = nx;
            py = ny;
            steps++;
        }
        this.draw();
    },
    win() {
        busy = true;
        this.note = 'Salida en ' + (steps + 1) + ' pasos';
        setTimeout(() => {
            this.note = '';
            makeMaze();
            this.newCanvas();
        }, WIN_MS);
    }
};
