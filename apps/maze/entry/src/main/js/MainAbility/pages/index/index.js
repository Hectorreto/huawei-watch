import brightness from '@system.brightness';
import storage from '@system.storage';

// Maze prototype: a first-person view of a small maze, drawn on a canvas one step at a time.
// What the watch allows shaped it (docs/compare-drawing-methods.md): a canvas takes about
// 1,100 fillRect before the app is killed and there is no clearRect, so only the parts of
// each column that change are drawn, and the canvas is remade when it nears the limit.
// Maze size in cells per side, one entry per level; after the last the size stays.
const LEVEL_CELLS = [7, 9, 11, 13, 15];
const WALL = 1;
const EXIT = 2;
const SCREEN = 466;
const COLS = 39;
const COL_W = 12;
// Half the width of the view, in cells at distance 1: about a 66 degree field of view.
const PLANE = 0.66;
// Wall height on screen is WALL_SCALE / distance, in px.
const WALL_SCALE = 380;
// Fixed bands above and below the horizon; a wall that shrinks is painted over with them.
const CEILING = '#1c2233';
const FLOOR = '#3a2c20';
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
// Taps above this, between the turn zones, open the map.
const MAP_ZONE = 100;
// Side of the map on screen, in px, so it fits inside the round screen.
const MAP_SIDE = 320;
const MAP_PATH = '#5a6478';
const MAP_PLAYER = '#ffe119';

let grid = [];
// Grid side: 2 * cells + 1, walls included.
let size = 15;
let level = 0;
// Fewest steps to the exit, by maze size (key 'best' + cells in storage), 0 if none.
let best = 0;
let seed = 1;
let px = 1;
let py = 1;
let facing = 1;
let steps = 0;
let ctx = null;
let onCanvas = 0;
let busy = true;
let mapOpen = false;
// 1 for each grid cell the player has stood on, by y * size + x.
let visited = [];
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
    size = 2 * LEVEL_CELLS[Math.min(level, LEVEL_CELLS.length - 1)] + 1;
    grid = [];
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
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
            if (nx > 0 && ny > 0 && nx < size - 1 && ny < size - 1 && grid[ny][nx] === WALL) {
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
    grid[size - 2][size - 1] = EXIT;
    px = 1;
    py = 1;
    facing = grid[1][2] === 0 ? 1 : 2;
    steps = 0;
    visited = [];
    for (let i = 0; i < size * size; i++) {
        visited.push(0);
    }
    visited[py * size + px] = 1;
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

// Reads a whole number from storage, 0 when it is missing or the read fails.
function loadNumber(key, callback) {
    storage.get({
        key: key,
        default: '0',
        success: (value) => callback(parseInt(value, 10) || 0),
        fail: () => callback(0)
    });
}

function fill(x, top, bottom, colour) {
    if (bottom > top) {
        ctx.fillStyle = colour;
        ctx.fillRect(x, top, COL_W - 1, bottom - top);
        onCanvas++;
    }
}

// Draws the cells walked so far, one rect per horizontal run, and the player as a yellow
// cell with a smaller mark on the side it faces. At most about size * size / 2 rects
// (some 480 at 15 x 15 cells), under the canvas limit.
function drawMap() {
    const cell = Math.floor(MAP_SIDE / size);
    const left = Math.round((SCREEN - cell * size) / 2);
    const top = Math.round((SCREEN - cell * size) / 2);
    ctx.fillStyle = MAP_PATH;
    for (let y = 0; y < size; y++) {
        let x = 0;
        while (x < size) {
            if (visited[y * size + x] !== 1) {
                x++;
                continue;
            }
            const start = x;
            while (x < size && visited[y * size + x] === 1) {
                x++;
            }
            ctx.fillRect(left + start * cell, top + y * cell, (x - start) * cell, cell);
        }
    }
    ctx.fillStyle = MAP_PLAYER;
    ctx.fillRect(left + px * cell, top + py * cell, cell, cell);
    const mark = Math.max(2, Math.floor(cell / 3));
    const mx = left + px * cell + (cell - mark) / 2 + DIRS[facing][0] * (cell + mark) / 2;
    const my = top + py * cell + (cell - mark) / 2 + DIRS[facing][1] * (cell + mark) / 2;
    ctx.fillRect(Math.round(mx), Math.round(my), mark, mark);
}

export default {
    data: {
        live: false,
        hud: '',
        record: '',
        note: ''
    },
    onInit() {
        try {
            brightness.setKeepScreenOn({ keepScreenOn: true });
        } catch (e) {
            // The screen just turns off as usual.
        }
        seed = Date.now() & 0x7fffffff;
        loadNumber('level', (value) => {
            level = value;
            this.startMaze();
        });
    },
    // Makes the maze for the current level and loads that size's record before showing it.
    startMaze() {
        makeMaze();
        loadNumber('best' + (size - 1) / 2, (value) => {
            best = value;
            this.newCanvas();
        });
    },
    // Removes the canvas (if it exists) and makes a fresh one, then draws the whole view, or
    // the map while it is open.
    newCanvas() {
        busy = true;
        ctx = null;
        this.live = false;
        setTimeout(() => {
            this.live = true;
            setTimeout(() => {
                ctx = this.$refs.cv.getContext('2d');
                busy = false;
                if (mapOpen) {
                    drawMap();
                    return;
                }
                ctx.fillStyle = CEILING;
                ctx.fillRect(0, 0, SCREEN, SCREEN / 2);
                ctx.fillStyle = FLOOR;
                ctx.fillRect(0, SCREEN / 2, SCREEN, SCREEN / 2);
                onCanvas = 2;
                for (let c = 0; c < COLS; c++) {
                    shownH[c] = 0;
                    shownColour[c] = '';
                }
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
                fill(x, mid - old / 2, mid - h / 2, CEILING);
                fill(x, mid + h / 2, mid + old / 2, FLOOR);
            }
            shownH[c] = h;
            shownColour[c] = view[c].colour;
        }
        this.hud = COMPASS[facing] + '  ' + steps;
        this.record = best > 0 ? 'Nivel ' + (level + 1) + '  récord ' + best : 'Nivel ' + (level + 1);
    },
    // Left third turns left, right third turns right, the bottom turns around, the compass
    // at the top opens the map, the rest of the middle steps forward; while the map is open
    // any tap closes it. The click event carries the position (globalX, globalY);
    // ontouchstart on this div did not fire in the Previewer.
    tap(e) {
        if (busy) {
            return;
        }
        const touchX = e && typeof e.globalX === 'number' ? e.globalX : SCREEN / 2;
        const touchY = e && typeof e.globalY === 'number' ? e.globalY : SCREEN / 2;
        this.note = '';
        if (mapOpen) {
            mapOpen = false;
            this.newCanvas();
            return;
        }
        if (touchY < MAP_ZONE && touchX >= TURN_ZONE && touchX <= SCREEN - TURN_ZONE) {
            mapOpen = true;
            this.newCanvas();
            return;
        }
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
            visited[py * size + px] = 1;
            steps++;
        }
        this.draw();
    },
    // Shows the steps, saves a new record for this size, and moves on to the next level.
    win() {
        busy = true;
        const taken = steps + 1;
        if (best === 0 || taken < best) {
            this.note = 'Nuevo récord: ' + taken + ' pasos';
            storage.set({ key: 'best' + (size - 1) / 2, value: String(taken) });
        } else {
            this.note = 'Salida en ' + taken + ' pasos';
        }
        level++;
        storage.set({ key: 'level', value: String(level) });
        setTimeout(() => {
            this.note = '';
            this.startMaze();
        }, WIN_MS);
    }
};
