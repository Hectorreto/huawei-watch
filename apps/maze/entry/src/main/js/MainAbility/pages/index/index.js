import brightness from '@system.brightness';
import storage from '@system.storage';
import vibrator from '@system.vibrator';

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
// One look per level, in turn, so each new maze looks different even once the size stops
// growing: wall colour and the fixed bands above and below the horizon (a wall that shrinks
// is painted over with them). No green walls, so the exit door stands out, and no cyan, so
// the gems do.
const THEMES = [
    { wall: [230, 160, 70], ceiling: '#1c2233', floor: '#3a2c20' },
    { wall: [120, 150, 235], ceiling: '#101428', floor: '#26283c' },
    { wall: [215, 95, 75], ceiling: '#2a1414', floor: '#301c18' },
    { wall: [175, 110, 220], ceiling: '#1a1030', floor: '#2a2030' },
    { wall: [190, 190, 175], ceiling: '#181c1c', floor: '#303028' }
];
// Draw calls allowed on one canvas before it is remade, under the ~1,100 that crash it.
const CANVAS_LIMIT = 900;
const CANVAS_WAIT_MS = 50;
// Taps are ignored this long on the result screen, so a fast last step does not skip it.
const RESULT_LOCK_MS = 600;
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
const MAP_GUARD = '#e6194b';
// Gems per maze, put in dead ends; picked up by stepping on them.
const GEMS = 3;
// Gem size and how far below the horizon it sits, as shares of the wall height there.
const GEM_SIZE = 0.35;
const GEM_FLOOR = 0.35;
// Steps allowed for the third star: this share of the shortest walk that takes every gem
// and leaves. Blind depth-first walks that take all gems get three stars 43% of the time
// on level 1 and 9% on level 5, guardian included (in Node); a player also sees dead ends
// from afar.
const PAR_SLACK = 1.5;
// The guardian: from the second level on it wakes at the start after this many steps per
// cell of the maze's side, then follows the player, one cell every so many steps (fewer
// from GUARD_FAST_LEVEL on). Turning costs no time; it moves only when the player does.
const GUARD_FROM_LEVEL = 1;
const GUARD_FAST_LEVEL = 3;
const GUARD_WAKE = 3;
const GUARD_EVERY = 3;
const GUARD_EVERY_FAST = 2;
// Its height as a share of the wall height there, and how near it starts the warnings.
const GUARD_SIZE = 0.85;
const GUARD_WARN = 6;
// How near it makes each step buzz on the wrist, like a heartbeat.
const GUARD_BUZZ = 3;
// Grid cells a catch sends the player back along the way, per cell of the maze's side. Not
// all the way to the start: that is some 180 taps to walk again in the largest mazes.
const GUARD_SETBACK = 2;
// The daily challenge plays as this level (its size and guardian), on a maze made from the
// date. The first finish of a day pays a bonus of one star per day of streak, up to the max.
const DAILY_LEVEL = 1;
const DAILY_BONUS_MAX = 5;
const DAY_MS = 86400000;
// On the menu, taps above this continue the levels and the rest open the daily challenge.
const MENU_SPLIT = 225;
const STAR_ON = '/common/star.png';
const STAR_OFF = '/common/star_off.png';
// Total stars needed for each rank.
const RANKS = [
    { stars: 0, name: 'Novato' },
    { stars: 10, name: 'Explorador' },
    { stars: 30, name: 'Cazagemas' },
    { stars: 60, name: 'Veterano' },
    { stars: 100, name: 'Maestro' },
    { stars: 150, name: 'Leyenda' }
];

let grid = [];
// Grid side: 2 * cells + 1, walls included.
let size = 15;
let level = 0;
// The level the current maze plays as: the saved level, or DAILY_LEVEL on the challenge.
let mazeLevel = 0;
let daily = false;
// Last day the challenge was finished (as a number like 20261102), the streak up to it, and
// that day's most stars and fewest steps (key 'daily' in storage: date,streak,stars,best).
let dailyDate = 0;
let dailyStreak = 0;
let dailyStars = 0;
let dailyBest = 0;
let theme = THEMES[0];
// Fewest steps to the exit, by maze size (key 'best' + cells in storage), 0 if none.
let best = 0;
// Stars earned in all mazes so far (key 'stars' in storage).
let totalStars = 0;
// Steps allowed for this maze's third star.
let par = 0;
let seed = 1;
let px = 1;
let py = 1;
let facing = 1;
let steps = 0;
let ctx = null;
let onCanvas = 0;
let busy = true;
let mapOpen = false;
let resultOpen = false;
let menuOpen = false;
// 1 for each grid cell the player has stood on, by y * size + x.
let visited = [];
// Gems still in the maze, as [x, y] grid cells, and how many were picked up.
let gems = [];
let gemsFound = 0;
// The way from the start to the player, as grid cells by y * size + x. The maze is a tree,
// so stepping back to the cell before pops it. The guardian only ever walks this way, so it
// is never ahead of the player and the exit can always be reached.
let trail = [];
// Steps since the maze began or the last catch; they say where the guardian is.
let guardSteps = 0;
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
    size = 2 * LEVEL_CELLS[Math.min(mazeLevel, LEVEL_CELLS.length - 1)] + 1;
    theme = THEMES[(daily ? today() : level) % THEMES.length];
    grid = [];
    // The cell each cell was carved from, by y * size + x, to measure walks in placeGems.
    const parent = [];
    for (let i = 0; i < size * size; i++) {
        parent.push(-1);
    }
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
        const wx = cur[0] + DIRS[d][0];
        const wy = cur[1] + DIRS[d][1];
        const nx = wx + DIRS[d][0];
        const ny = wy + DIRS[d][1];
        grid[wy][wx] = 0;
        grid[ny][nx] = 0;
        parent[wy * size + wx] = cur[1] * size + cur[0];
        parent[ny * size + nx] = wy * size + wx;
        stack.push([nx, ny]);
    }
    grid[size - 2][size - 1] = EXIT;
    toStart();
    steps = 0;
    visited = [];
    for (let i = 0; i < size * size; i++) {
        visited.push(0);
    }
    visited[py * size + px] = 1;
    placeGems();
    par = Math.round(shortestWalk(parent) * PAR_SLACK);
}

// Puts the player at the start, with the guardian asleep.
function toStart() {
    px = 1;
    py = 1;
    facing = grid[1][2] === 0 ? 1 : 2;
    trail = [py * size + px];
    guardSteps = 0;
}

// A catch: the player goes back along the way, facing where it was heading, and the
// guardian sleeps at the start again.
function setBack() {
    // An odd length, so the player lands on a maze cell and never on the one between two:
    // a tap walks two grid cells, and from there the second could be a wall.
    let keep = Math.max(1, trail.length - GUARD_SETBACK * (size - 1) / 2);
    keep -= (keep + 1) % 2;
    const next = trail[keep];
    trail.length = keep;
    px = trail[keep - 1] % size;
    py = Math.floor(trail[keep - 1] / size);
    for (let d = 0; d < 4; d++) {
        if ((py + DIRS[d][1]) * size + px + DIRS[d][0] === next) {
            facing = d;
        }
    }
    guardSteps = 0;
}

// Where the guardian is on the trail, or -1 while it sleeps or on the first level. It moves
// a whole number of cells from its steps alone, so it needs no state of its own.
function guardIndex() {
    if (mazeLevel < GUARD_FROM_LEVEL) {
        return -1;
    }
    const awake = guardSteps - GUARD_WAKE * (size - 1) / 2;
    if (awake < 0) {
        return -1;
    }
    return Math.floor(awake / (mazeLevel < GUARD_FAST_LEVEL ? GUARD_EVERY : GUARD_EVERY_FAST));
}

// Steps of the shortest walk from the start through every gem and out of the door. The maze
// is a tree: that walk goes twice over every cell on the way to a gem or the exit, except
// for the way to the exit, which it walks once.
function shortestWalk(parent) {
    const start = py * size + px;
    const exitCell = (size - 2) * size + size - 2;
    let toExit = 0;
    for (let c = exitCell; c !== start; c = parent[c]) {
        toExit++;
    }
    const marks = {};
    let cells = 0;
    const targets = [exitCell];
    for (let i = 0; i < gems.length; i++) {
        targets.push(gems[i][1] * size + gems[i][0]);
    }
    for (let i = 0; i < targets.length; i++) {
        for (let c = targets[i]; c !== start && !marks[c]; c = parent[c]) {
            marks[c] = true;
            cells++;
        }
    }
    return 2 * cells - toExit + 1;
}

function dayNumber(date) {
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function today() {
    return dayNumber(new Date());
}

// The streak as it stands today: it is lost once a whole day goes by without a finish.
function streakNow() {
    const alive = dailyDate === today() || dailyDate === dayNumber(new Date(Date.now() - DAY_MS));
    return alive ? dailyStreak : 0;
}

function saveDaily() {
    storage.set({ key: 'daily', value: [dailyDate, dailyStreak, dailyStars, dailyBest].join(',') });
}

// Names the player's rank and the next one for this many stars.
function rankLines(stars) {
    let r = 0;
    while (r + 1 < RANKS.length && stars >= RANKS[r + 1].stars) {
        r++;
    }
    return {
        rank: 'Total ' + stars + ' estrellas: ' + RANKS[r].name,
        next: r + 1 < RANKS.length
            ? 'Faltan ' + (RANKS[r + 1].stars - stars) + ' para ' + RANKS[r + 1].name
            : 'Rango máximo'
    };
}

// Puts the gems in random dead ends (cells with one way out), never on the start.
function placeGems() {
    const ends = [];
    for (let y = 1; y < size - 1; y += 2) {
        for (let x = 1; x < size - 1; x += 2) {
            let open = 0;
            for (let d = 0; d < 4; d++) {
                if (grid[y + DIRS[d][1]][x + DIRS[d][0]] === 0) {
                    open++;
                }
            }
            if (open === 1 && (x !== px || y !== py)) {
                ends.push([x, y]);
            }
        }
    }
    gems = [];
    gemsFound = 0;
    while (gems.length < GEMS && ends.length > 0) {
        gems.push(ends.splice(Math.floor(random() * ends.length), 1)[0]);
    }
}

// Where a grid cell falls on screen, or null when it is behind the player, off to a side, or
// the wall in its middle column is nearer than it (no partial hiding behind corners).
function project(x, y, view) {
    const dx = DIRS[facing][0];
    const dy = DIRS[facing][1];
    const ox = x - px;
    const oy = y - py;
    const ahead = ox * dx + oy * dy;
    const side = ox * -dy + oy * dx;
    if (ahead <= 0) {
        return null;
    }
    const cam = side / (ahead * PLANE);
    const c = Math.floor((cam + 1) / 2 * COLS);
    if (c < 0 || c >= COLS || view[c].dist < ahead) {
        return null;
    }
    return { ahead: ahead, wallH: WALL_SCALE / ahead, centreX: (cam + 1) / 2 * COLS * COL_W };
}

// Places each gem the player can see as an image over the view: sized and lowered by its
// distance. Far gems come first so near ones are drawn over them.
function gemSprites(view) {
    const shown = [];
    for (let i = 0; i < gems.length; i++) {
        const at = project(gems[i][0], gems[i][1], view);
        if (at === null) {
            continue;
        }
        const s = Math.max(8, Math.round(at.wallH * GEM_SIZE));
        shown.push({
            ahead: at.ahead,
            x: Math.round(at.centreX - s / 2),
            y: Math.round(SCREEN / 2 + at.wallH * GEM_FLOOR - s / 2),
            s: s
        });
    }
    shown.sort((a, b) => b.ahead - a.ahead);
    return shown;
}

// Vibrates for rare events only, never for every tap; 'short' or 'long'.
function buzz(mode) {
    try {
        vibrator.vibrate({ mode: mode });
    } catch (e) {
        // The game goes on without it.
    }
}

function hex2(v) {
    return (v < 16 ? '0' : '') + v.toString(16);
}

// Wall colour by what was hit, which side (x or y faces, for some sense of depth) and
// distance, darkened in four bands so a column keeps its colour over small changes.
function wallColour(cell, side, dist) {
    const band = Math.min(3, Math.floor(dist / 2));
    const light = (side === 0 ? 1 : 0.75) * (1 - band * 0.2);
    const base = cell === EXIT ? [80, 220, 110] : theme.wall;
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
        view.push({ h: h, dist: dist, colour: wallColour(grid[my][mx], side, dist) });
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
    const g = guardIndex();
    if (g >= 0) {
        ctx.fillStyle = MAP_GUARD;
        ctx.fillRect(left + (trail[g] % size) * cell, top + Math.floor(trail[g] / size) * cell, cell, cell);
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
        note: '',
        sprites: [],
        guardX: SCREEN,
        guardY: 0,
        guardS: 64,
        menu: false,
        menuLevel: '',
        menuDaily: '',
        menuRank: '',
        result: false,
        resultTitle: '',
        starGems: STAR_OFF,
        starPar: STAR_OFF,
        resultGems: '',
        resultSteps: '',
        resultRecord: '',
        resultRank: '',
        resultNext: ''
    },
    onInit() {
        try {
            brightness.setKeepScreenOn({ keepScreenOn: true });
        } catch (e) {
            // The screen just turns off as usual.
        }
        loadNumber('level', (value) => {
            level = value;
            loadNumber('stars', (stars) => {
                totalStars = stars;
                this.loadDaily();
            });
        });
    },
    loadDaily() {
        storage.get({
            key: 'daily',
            default: '',
            success: (value) => {
                const parts = String(value).split(',');
                dailyDate = parseInt(parts[0], 10) || 0;
                dailyStreak = parseInt(parts[1], 10) || 0;
                dailyStars = parseInt(parts[2], 10) || 0;
                dailyBest = parseInt(parts[3], 10) || 0;
                this.showMenu();
            },
            fail: () => this.showMenu()
        });
    },
    // The first screen, and where the daily challenge returns to. No canvas lives under it.
    showMenu() {
        ctx = null;
        this.live = false;
        this.sprites = [];
        this.guardX = SCREEN;
        this.note = '';
        this.menuLevel = 'Nivel ' + (level + 1);
        this.menuDaily = 'Racha ' + streakNow() + '  '
            + (dailyDate === today() ? 'hoy ' + dailyStars + '/3' : 'hoy sin jugar');
        this.menuRank = rankLines(totalStars).rank;
        this.menu = true;
        menuOpen = true;
        busy = false;
    },
    // Makes the maze for the current level and loads that size's record before showing it;
    // the challenge's maze comes from the date, the same all day, with its record for today.
    startMaze() {
        mazeLevel = daily ? DAILY_LEVEL : level;
        seed = daily ? (today() * 2654435) & 0x7fffffff : Date.now() & 0x7fffffff;
        if (daily) {
            // The first numbers from nearby seeds are alike, so these are dropped.
            for (let i = 0; i < 8; i++) {
                random();
            }
        }
        makeMaze();
        if (daily) {
            best = dailyDate === today() ? dailyBest : 0;
            this.note = best > 0 ? 'Mejor hoy: ' + best + ' pasos' : '';
            this.newCanvas();
            return;
        }
        loadNumber('best' + (size - 1) / 2, (value) => {
            best = value;
            this.note = best > 0 ? 'Récord: ' + best + ' pasos' : '';
            this.newCanvas();
        });
    },
    // Removes the canvas (if it exists) and makes a fresh one, then draws the whole view, or
    // the map while it is open.
    newCanvas() {
        busy = true;
        ctx = null;
        this.live = false;
        this.sprites = [];
        this.guardX = SCREEN;
        setTimeout(() => {
            this.live = true;
            setTimeout(() => {
                ctx = this.$refs.cv.getContext('2d');
                busy = false;
                if (mapOpen) {
                    drawMap();
                    return;
                }
                ctx.fillStyle = theme.ceiling;
                ctx.fillRect(0, 0, SCREEN, SCREEN / 2);
                ctx.fillStyle = theme.floor;
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
                fill(x, mid - old / 2, mid - h / 2, theme.ceiling);
                fill(x, mid + h / 2, mid + old / 2, theme.floor);
            }
            shownH[c] = h;
            shownColour[c] = view[c].colour;
        }
        this.sprites = gemSprites(view);
        this.showGuard(view);
        this.hud = COMPASS[facing] + ' ' + steps + '/' + par;
        this.record = (daily ? 'Reto del día' : 'Nivel ' + (level + 1)) + '  gemas ' + gemsFound + '/' + (gems.length + gemsFound);
    },
    // Stands the guardian on the floor when the player can see it (one fixed image, moved off
    // the screen when not), and warns when it woke or comes near, unless a note is showing.
    showGuard(view) {
        const g = guardIndex();
        const at = g < 0 ? null : project(trail[g] % size, Math.floor(trail[g] / size), view);
        if (at === null) {
            this.guardX = SCREEN;
        } else {
            const s = Math.round(at.wallH * GUARD_SIZE);
            this.guardS = s;
            this.guardX = Math.round(at.centreX - s / 2);
            this.guardY = Math.round(SCREEN / 2 + at.wallH / 2 - s);
        }
        if (g < 0 || this.note !== '') {
            return;
        }
        const gap = trail.length - 1 - g;
        if (gap <= GUARD_WARN) {
            this.note = 'Guardián a ' + gap + (gap === 1 ? ' paso' : ' pasos');
        } else if (guardSteps - GUARD_WAKE * (size - 1) / 2 < 2) {
            // A tap walks two steps, so the step it woke on may fall inside one.
            this.note = 'El guardián despertó';
        }
    },
    // Left third turns left, right third turns right, the bottom turns around, the compass
    // at the top opens the map, the rest of the middle steps forward; while the map is open
    // any tap closes it, and on the result screen any tap starts the next maze. The click event carries the position (globalX, globalY);
    // ontouchstart on this div did not fire in the Previewer.
    tap(e) {
        if (busy) {
            return;
        }
        const touchX = e && typeof e.globalX === 'number' ? e.globalX : SCREEN / 2;
        const touchY = e && typeof e.globalY === 'number' ? e.globalY : SCREEN / 2;
        if (menuOpen) {
            menuOpen = false;
            busy = true;
            this.menu = false;
            daily = touchY >= MENU_SPLIT;
            this.startMaze();
            return;
        }
        if (resultOpen) {
            resultOpen = false;
            busy = true;
            this.result = false;
            if (daily) {
                this.showMenu();
            } else {
                this.startMaze();
            }
            return;
        }
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
            // A tap crosses a whole maze cell: the grid cell between two of them offers no
            // choice, so it would only be one more tap. Steps still count grid cells, so old
            // records compare, and only the end is drawn.
            if (this.stepOnce() && this.stepOnce()) {
                const g = guardIndex();
                if (g >= 0 && trail.length - 1 - g <= GUARD_BUZZ) {
                    buzz('short');
                }
            }
        }
        this.draw();
    },
    // Moves one grid cell forward; false when the guardian caught the player there.
    stepOnce() {
        px += DIRS[facing][0];
        py += DIRS[facing][1];
        visited[py * size + px] = 1;
        steps++;
        guardSteps++;
        const cell = py * size + px;
        if (trail.length > 1 && trail[trail.length - 2] === cell) {
            trail.pop();
        } else {
            trail.push(cell);
        }
        for (let i = 0; i < gems.length; i++) {
            if (gems[i][0] === px && gems[i][1] === py) {
                gems.splice(i, 1);
                gemsFound++;
                this.note = 'Gema ' + gemsFound + ' de ' + (gems.length + gemsFound);
                buzz('short');
                break;
            }
        }
        const g = guardIndex();
        if (g >= 0 && g >= trail.length - 1) {
            // Steps, gems and the map stay; the walk back and the steps are the price.
            setBack();
            this.note = 'Te atrapó: retrocedes';
            buzz('long');
            return false;
        }
        return true;
    },
    // Scores the maze: one star for leaving, one for all its gems, one for staying within par.
    // Saves the result and shows it until a tap.
    win() {
        busy = true;
        buzz('long');
        const taken = steps + 1;
        const totalGems = gems.length + gemsFound;
        const allGems = gems.length === 0;
        const withinPar = taken <= par;
        const earned = 1 + (allGems ? 1 : 0) + (withinPar ? 1 : 0);
        if (daily) {
            this.scoreDaily(taken, earned);
        } else {
            this.scoreLevel(taken, earned);
        }
        storage.set({ key: 'stars', value: String(totalStars) });
        const lines = rankLines(totalStars);
        this.starGems = allGems ? STAR_ON : STAR_OFF;
        this.starPar = withinPar ? STAR_ON : STAR_OFF;
        this.resultGems = 'Gemas ' + gemsFound + '/' + totalGems;
        this.resultSteps = 'Pasos ' + taken + '  par ' + par;
        this.resultRank = lines.rank;
        this.resultNext = lines.next;
        this.result = true;
        resultOpen = true;
        setTimeout(() => {
            busy = false;
        }, RESULT_LOCK_MS);
    },
    // Adds the stars, saves a new record for this size and moves on to the next level.
    scoreLevel(taken, earned) {
        totalStars += earned;
        if (best === 0 || taken < best) {
            this.resultRecord = 'Nuevo récord';
            storage.set({ key: 'best' + (size - 1) / 2, value: String(taken) });
        } else {
            this.resultRecord = 'Récord: ' + best + ' pasos';
        }
        this.resultTitle = 'Nivel ' + (level + 1) + ' superado';
        level++;
        storage.set({ key: 'level', value: String(level) });
    },
    // The first finish of a day extends the streak and pays its bonus. Playing again the same
    // day can only add the stars it beats that day's best by, so it cannot be farmed.
    scoreDaily(taken, earned) {
        const now = today();
        this.resultTitle = 'Reto del día';
        if (dailyDate !== now) {
            dailyStreak = streakNow() + 1;
            dailyDate = now;
            dailyStars = 0;
            dailyBest = taken;
            const bonus = Math.min(dailyStreak, DAILY_BONUS_MAX);
            totalStars += bonus;
            this.resultRecord = 'Racha ' + dailyStreak + ': +' + bonus + (bonus === 1 ? ' estrella' : ' estrellas');
        } else if (taken < dailyBest) {
            dailyBest = taken;
            this.resultRecord = 'Mejor de hoy';
        } else {
            this.resultRecord = 'Mejor hoy: ' + dailyBest + ' pasos';
        }
        if (earned > dailyStars) {
            totalStars += earned - dailyStars;
            dailyStars = earned;
        }
        saveDaily();
    }
};
