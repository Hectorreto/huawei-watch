import brightness from '@system.brightness';
import storage from '@system.storage';
import vibrator from '@system.vibrator';

// Órbita: a ball crosses a round arena; the crown (or a tap or drag on either half of the
// screen) turns the arena (its spikes and its diamond) around the centre, but not the ball.
// Diamonds score, spikes end the game. Positions are in px from the screen centre, angles in radians with
// screen axes (x right, y down), so a growing angle turns clockwise.

const MID = 233;
const WALL = 224;              // inner edge of the ring
const BALL_R = 10;
const SPIKES = 10;
const SPIKE_DIRS = 24;         // spike_00.png ... spike_23.png, one per 15 degrees
const SPIKE_RADIUS = 213;      // centre of a spike image, so its base lies on the wall
const SPIKE_HALF = 16;         // half the spike image
const SPIKE_GAP = 0.112;       // angle between two spikes of a group (about 25 px)
const SPIKE_HIT = BALL_R + 8;  // the ball touches a spike within this distance of its centre
const DIAMOND_HALF = 15;
const DIAMOND_HIT = BALL_R + 13;
const TURN_SPEED = 3.2;        // rad/s while a half of the screen is held
const TAP_TURN = 0.4;          // one tap turns the arena this far (about 23 degrees)...
const TAP_TURN_SPEED = 4;      // ...at this many rad/s
const BASE_SPEED = 270;        // px/s, plus SPEED_STEP per point up to MAX_SPEED
const SPEED_STEP = 2;
const MAX_SPEED = 400;
const FRAME_MS = 33;
const BOUNCE_OFF_MIN = 0.02;   // after a bounce the ball heads 1 to 5 degrees off the centre
const BOUNCE_OFF_MAX = 0.09;
const CURVE_MIN = 0.04;        // rad/s its heading turns, to a random side: about 5 degrees
const CURVE_MAX = 0.1;         // over a crossing
const SRC_SWAPS_PER_FRAME = 2; // spike images whose direction may change in one frame
const REVEALS_PER_FRAME = 3;   // new spikes shown per frame after a bounce
const SHOW_FRAME_MS = true;    // while playing, the line shows the average and the slowest ms
                               // per frame of the last second (a measuring aid for the watch)
const MAX_DT = 0.1;            // a slower frame moves the game less, so it never jumps far
const SUBSTEP_PX = 6;          // collisions are checked at least every 6 px of travel
const CROWN_MAX = 1000;        // the hidden slider the crown turns runs 0..CROWN_MAX...
const CROWN_MID = 500;         // ...and is put back near the middle after each change
const CROWN_GAIN = 0.07;       // rad per unit of slider change: the GT 6 Pro's crown moves it
                               // by about 2 per event, so about 8 degrees (the Previewer: 10)
const CROWN_MAX_STEP = 0.15;   // at most this many rad per event, less than a spike's width
                               // at the wall, so a spike cannot jump over the ball
const FOCUS_DELAY_MS = 50;     // the slider exists only once the page has rendered
const OVER_PAUSE_MS = 700;     // touches right after losing are ignored
const OFF = -100;              // where hidden sprites go
const SAVE_KEY = 'orbita';
const SAVE_FIELDS = 21;
const SAVE_VERSION = 2;        // 1 kept 10 spike angles; it still gives the score and record
const MIN_GROUPS = 2;          // the 10 spikes come in 2 to 5 groups...
const MAX_GROUPS = 5;
const MAX_GROUP_SIZE = 5;      // ...of 1 to 5 spikes each...
const GROUP_SPACE = 0.3;       // ...with at least this much wall (rad) between two groups
const IMMUNE_TIME = 0.35;      // s after a bounce when spikes cannot kill, since they may
                               // reappear right on top of the ball
const BALL_IMMUNE = '#9fdcff';
const BALL_COLOUR = '#ffffff';
const BALL_LOST = '#ff5040';
const TWO_PI = Math.PI * 2;

const SPIKE_SRC = [];
for (let i = 0; i < SPIKE_DIRS; i++) {
    SPIKE_SRC.push('/common/spike_' + (i < 10 ? '0' : '') + i + '.png');
}

// Game state lives in module variables: plain properties of the page object did not reach
// `this` in the drawing lab.
let page = null;
let loaded = false;
let phase = 'ready';           // 'ready' (waiting for the first touch), 'play' or 'over'
let score = 0;
let best = 0;
let ballX = 0;
let ballY = 0;
let heading = 0;
let curve = 0;                 // rad/s the heading turns, a slight curve
let spin = 0;                  // how far the arena has turned
let hold = 0;                  // -1 left half held, 1 right half, 0 none
let pendingTurn = 0;           // what taps still have to turn
let crownLast = CROWN_MID;     // the slider's value after the last change
let crownFlip = 0;             // alternates the reset value so the binding always changes
let groupCount = 0;            // 0 before the first bounce: no spikes yet
const groupSize = [0, 0, 0, 0, 0];
const groupAngle = [0, 0, 0, 0, 0]; // centre of each group, in the arena's own frame
let spikeCount = 0;            // 0 or SPIKES: the spikes laid out from the groups
const spikeAngle = [];         // each spike's angle, in the arena's own frame
const revealed = [];           // whether each spike is on the screen yet
for (let i = 0; i < SPIKES; i++) {
    spikeAngle.push(0);
    revealed.push(false);
}
let diamondR = 0;
let diamondA = 0;              // in the arena's own frame
let timer = null;
let lastTime = 0;
let overUntil = 0;
let drawnSpin = null;          // spin when the arena was last placed, null to force it
let immune = 0;                // s of immunity left
const shownBall = [MID - BALL_R, MID - BALL_R];
const shownX = [];             // what each spike's bindings hold
const shownY = [];
const shownDir = [];
for (let i = 0; i < SPIKES; i++) {
    shownX.push(OFF);
    shownY.push(OFF);
    shownDir.push(0);
}
let nextSwap = 0;
let perfStart = 0;
let perfFrames = 0;
let perfLast = 0;
let perfWorst = 0;

function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
}

function randCurve() {
    return randSign() * rand(CURVE_MIN, CURVE_MAX);
}

function randSign() {
    return Math.random() < 0.5 ? -1 : 1;
}

function buzz(mode) {
    try {
        vibrator.vibrate({ mode: mode });
    } catch (e) {
        // The game goes on without it.
    }
}

function keepScreen(on) {
    try {
        brightness.setKeepScreenOn({ keepScreenOn: on });
    } catch (e) {
        // The screen just behaves as usual.
    }
}

function round3(v) {
    return Math.round(v * 1000) / 1000;
}

function save() {
    const parts = [score, best, round3(ballX), round3(ballY), round3(heading), round3(curve),
        round3(spin % TWO_PI), groupCount, round3(diamondR), round3(diamondA)];
    for (let g = 0; g < MAX_GROUPS; g++) {
        parts.push(groupSize[g]);
    }
    for (let g = 0; g < MAX_GROUPS; g++) {
        parts.push(round3(groupAngle[g]));
    }
    parts.push(SAVE_VERSION);
    storage.set({ key: SAVE_KEY, value: parts.join(',') });
}

function freshRound() {
    ballX = 0;
    ballY = 0;
    heading = rand(0, TWO_PI);
    curve = randCurve();
    groupCount = 0;
    layOutSpikes();
    placeDiamond();
}

// A new diamond somewhere inside the arena, not right next to the ball.
function placeDiamond() {
    for (let tries = 0; tries < 12; tries++) {
        diamondR = rand(40, 170);
        diamondA = rand(0, TWO_PI);
        const a = diamondA + spin;
        const dx = Math.cos(a) * diamondR - ballX;
        const dy = Math.sin(a) * diamondR - ballY;
        if (dx * dx + dy * dy > 90 * 90) {
            break;
        }
    }
    drawnSpin = null;
}

function angleApart(a, b) {
    return Math.abs((((a - b) % TWO_PI) + TWO_PI + Math.PI) % TWO_PI - Math.PI);
}

// The spikes of the groups, side by side SPIKE_GAP apart, all hidden until draw() shows them
// a few a frame (REVEALS_PER_FRAME), so a bounce does not change every image at once.
function layOutSpikes() {
    spikeCount = groupCount > 0 ? SPIKES : 0;
    let n = 0;
    for (let g = 0; g < groupCount; g++) {
        const first = groupAngle[g] - (groupSize[g] - 1) * SPIKE_GAP / 2;
        for (let j = 0; j < groupSize[g] && n < SPIKES; j++) {
            spikeAngle[n++] = first + j * SPIKE_GAP;
        }
    }
    for (let i = 0; i < SPIKES; i++) {
        revealed[i] = false;
    }
    drawnSpin = null;
}

// After each bounce the 10 spikes move to 2-5 groups of 1-5 at random places on the wall,
// anywhere, even where the ball is (the ball is immune for a moment, IMMUNE_TIME). Groups
// keep GROUP_SPACE between them when a few tries find room.
function moveSpikes() {
    groupCount = MIN_GROUPS + Math.floor(Math.random() * (MAX_GROUPS - MIN_GROUPS + 1));
    for (let g = 0; g < MAX_GROUPS; g++) {
        groupSize[g] = g < groupCount ? 1 : 0;
    }
    for (let left = SPIKES - groupCount; left > 0;) {
        const g = Math.floor(Math.random() * groupCount);
        if (groupSize[g] < MAX_GROUP_SIZE) {
            groupSize[g]++;
            left--;
        }
    }
    for (let g = 0; g < groupCount; g++) {
        const half = (groupSize[g] - 1) * SPIKE_GAP / 2;
        let centre = 0;
        for (let tries = 0; tries < 20; tries++) {
            centre = rand(0, TWO_PI);
            let fits = true;
            for (let k = 0; k < g; k++) {
                const other = (groupSize[k] - 1) * SPIKE_GAP / 2;
                if (angleApart(centre, groupAngle[k] + spin) < half + other + GROUP_SPACE) {
                    fits = false;
                    break;
                }
            }
            if (fits) {
                break;
            }
        }
        groupAngle[g] = centre - spin;
    }
    layOutSpikes();
}

// The images are only for show: a hit is worked out from each spike's exact angle. Only
// spikes already on the screen count.
function touchesSpike() {
    for (let i = 0; i < spikeCount; i++) {
        if (!revealed[i]) {
            continue;
        }
        const a = spikeAngle[i] + spin;
        const dx = Math.cos(a) * SPIKE_RADIUS - ballX;
        const dy = Math.sin(a) * SPIKE_RADIUS - ballY;
        if (dx * dx + dy * dy < SPIKE_HIT * SPIKE_HIT) {
            return true;
        }
    }
    return false;
}

function touchesDiamond() {
    const a = diamondA + spin;
    const dx = Math.cos(a) * diamondR - ballX;
    const dy = Math.sin(a) * diamondR - ballY;
    return dx * dx + dy * dy < DIAMOND_HIT * DIAMOND_HIT;
}

// The ball heads back towards the centre, slightly off (BOUNCE_OFF), with a new slight curve.
function bounce() {
    const hit = Math.atan2(ballY, ballX);
    const r = WALL - BALL_R - 0.5;
    ballX = Math.cos(hit) * r;
    ballY = Math.sin(hit) * r;
    heading = (hit + Math.PI + randSign() * rand(BOUNCE_OFF_MIN, BOUNCE_OFF_MAX)) % TWO_PI;
    curve = randCurve();
}

export default {
    data: {
        score: '0',
        line: '',
        ballColour: BALL_COLOUR,
        bx: MID - BALL_R,
        by: MID - BALL_R,
        gx: OFF,
        gy: OFF,
        s0: SPIKE_SRC[0], s1: SPIKE_SRC[0], s2: SPIKE_SRC[0], s3: SPIKE_SRC[0], s4: SPIKE_SRC[0],
        s5: SPIKE_SRC[0], s6: SPIKE_SRC[0], s7: SPIKE_SRC[0], s8: SPIKE_SRC[0], s9: SPIKE_SRC[0],
        x0: OFF, x1: OFF, x2: OFF, x3: OFF, x4: OFF, x5: OFF, x6: OFF, x7: OFF, x8: OFF, x9: OFF,
        y0: OFF, y1: OFF, y2: OFF, y3: OFF, y4: OFF, y5: OFF, y6: OFF, y7: OFF, y8: OFF, y9: OFF,
        crownMax: CROWN_MAX,
        crownValue: CROWN_MID
    },
    onInit() {
        page = this;
        freshRound();
        storage.get({
            key: SAVE_KEY,
            default: '',
            success: (value) => this.load(String(value)),
            fail: () => this.load('')
        });
    },
    load(value) {
        const p = value.split(',').map((v) => parseFloat(v));
        if (p.length === SAVE_FIELDS && p.every((v) => !isNaN(v))) {
            score = Math.max(0, Math.floor(p[0]));
            best = Math.max(score, Math.floor(p[1]));
        }
        if (p.length === SAVE_FIELDS && p[SAVE_FIELDS - 1] === SAVE_VERSION
            && p.every((v) => !isNaN(v))) {
            ballX = p[2];
            ballY = p[3];
            heading = p[4];
            curve = p[5];
            spin = p[6];
            groupCount = Math.max(0, Math.min(MAX_GROUPS, Math.floor(p[7])));
            diamondR = p[8];
            diamondA = p[9];
            for (let g = 0; g < MAX_GROUPS; g++) {
                groupSize[g] = Math.max(1, Math.min(MAX_GROUP_SIZE, Math.floor(p[10 + g])));
                groupAngle[g] = p[15 + g];
            }
            layOutSpikes();
            if (ballX * ballX + ballY * ballY > WALL * WALL) {
                freshRound();
            }
        }
        loaded = true;
        this.showReady();
        this.draw();
        this.focusCrown();
    },
    onDestroy() {
        this.stop();
        if (loaded) {
            save();
        }
        keepScreen(false);
        page = null;
    },
    showReady() {
        phase = 'ready';
        this.score = String(score);
        this.line = best > 0 ? 'Récord ' + best : 'Toca para jugar';
        this.ballColour = BALL_COLOUR;
    },
    // Turning the crown changes the hidden slider that has the crown focus (as the clicker's
    // lists scroll with it); lite gives a page no crown event of its own before API 24.
    focusCrown() {
        setTimeout(() => {
            const crown = this.$refs.crown;
            if (crown && crown.rotation) {
                crown.rotation({ focus: true });
            }
        }, FOCUS_DELAY_MS);
    },
    crownTurn(e) {
        const value = e && typeof e.value === 'number' ? e.value : crownLast;
        const delta = value - crownLast;
        crownLast = value;
        if (value < CROWN_MAX * 0.2 || value > CROWN_MAX * 0.8) {
            crownFlip = 1 - crownFlip;
            crownLast = CROWN_MID + crownFlip;
            this.crownValue = crownLast;
        }
        if (delta === 0 || phase !== 'play') {
            return;
        }
        // Straight onto the arena: the crown's events already come many times a second.
        spin += Math.max(-CROWN_MAX_STEP, Math.min(CROWN_MAX_STEP, delta * CROWN_GAIN));
    },
    start() {
        phase = 'play';
        this.line = '';
        this.ballColour = BALL_COLOUR;
        lastTime = Date.now();
        perfStart = lastTime;
        perfLast = lastTime;
        perfFrames = 0;
        perfWorst = 0;
        keepScreen(true);
        if (timer === null) {
            timer = setInterval(() => {
                if (page) {
                    page.frame();
                }
            }, FRAME_MS);
        }
    },
    stop() {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    },
    frame() {
        const now = Date.now();
        const dt = Math.min(MAX_DT, Math.max(0, (now - lastTime) / 1000));
        lastTime = now;
        if (SHOW_FRAME_MS) {
            perfFrames++;
            perfWorst = Math.max(perfWorst, now - perfLast);
            perfLast = now;
            if (now - perfStart >= 1000) {
                this.line = Math.round((now - perfStart) / perfFrames) + ' ms, máx ' + perfWorst;
                perfStart = now;
                perfFrames = 0;
                perfWorst = 0;
            }
        }
        if (hold !== 0) {
            spin += hold * TURN_SPEED * dt;
            pendingTurn = 0;
        } else if (pendingTurn !== 0) {
            const turn = Math.min(Math.abs(pendingTurn), TAP_TURN_SPEED * dt);
            const sign = pendingTurn < 0 ? -1 : 1;
            spin += sign * turn;
            pendingTurn -= sign * turn;
        }
        const speed = Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_STEP);
        const travel = speed * dt;
        const steps = Math.max(1, Math.ceil(travel / SUBSTEP_PX));
        const stepLen = travel / steps;
        const limit = (WALL - BALL_R) * (WALL - BALL_R);
        if (immune > 0) {
            immune -= dt;
            if (immune <= 0) {
                this.ballColour = BALL_COLOUR;
            }
        }
        for (let i = 0; i < steps; i++) {
            heading += curve * dt / steps;
            ballX += Math.cos(heading) * stepLen;
            ballY += Math.sin(heading) * stepLen;
            if (immune <= 0 && touchesSpike()) {
                this.lose();
                return;
            }
            if (ballX * ballX + ballY * ballY >= limit) {
                bounce();
                // Hitting the spikes that were there is still a loss; the new ones are not.
                if (immune <= 0 && touchesSpike()) {
                    this.lose();
                    return;
                }
                moveSpikes();
                immune = IMMUNE_TIME;
                this.ballColour = BALL_IMMUNE;
            }
            if (touchesDiamond()) {
                this.point();
            }
        }
        this.draw();
    },
    point() {
        score++;
        if (score > best) {
            best = score;
        }
        this.score = String(score);
        buzz('short');
        placeDiamond();
        save();
    },
    lose() {
        this.stop();
        phase = 'over';
        hold = 0;
        pendingTurn = 0;
        immune = 0;
        overUntil = Date.now() + OVER_PAUSE_MS;
        keepScreen(false);
        buzz('long');
        this.draw();
        this.ballColour = BALL_LOST;
        this.line = score > 0 && score === best ? '¡Récord!' : 'Récord ' + best;
        // The next game starts from 0 and is saved now, in case the app closes. The lost ball
        // stays drawn where it hit until the next touch draws the new round.
        score = 0;
        spin %= TWO_PI;
        freshRound();
        save();
    },
    // Places the ball every frame, the diamond when the arena moved, and the spikes.
    // What each binding holds is kept in module arrays, so nothing is read back from the page.
    // Changing an image's src is slow on the watch (the lab: 51 ms a frame against 34 for a
    // move), so new spikes are shown at most REVEALS_PER_FRAME a frame, and while the arena
    // turns at most SRC_SWAPS_PER_FRAME spikes take their new direction each frame, in turn.
    draw() {
        const bx = Math.round(MID + ballX - BALL_R);
        const by = Math.round(MID + ballY - BALL_R);
        if (shownBall[0] !== bx) {
            shownBall[0] = bx;
            this.bx = bx;
        }
        if (shownBall[1] !== by) {
            shownBall[1] = by;
            this.by = by;
        }
        if (drawnSpin !== spin) {
            drawnSpin = spin;
            const ga = diamondA + spin;
            this.gx = Math.round(MID + Math.cos(ga) * diamondR - DIAMOND_HALF);
            this.gy = Math.round(MID + Math.sin(ga) * diamondR - DIAMOND_HALF);
        }
        let reveals = REVEALS_PER_FRAME;
        let swaps = SRC_SWAPS_PER_FRAME;
        const start = nextSwap;
        for (let k = 0; k < SPIKES; k++) {
            const i = (start + k) % SPIKES;
            let x = OFF;
            let y = OFF;
            if (i < spikeCount) {
                const a = spikeAngle[i] + spin;
                let dir = Math.round(a / TWO_PI * SPIKE_DIRS) % SPIKE_DIRS;
                if (dir < 0) {
                    dir += SPIKE_DIRS;
                }
                if (!revealed[i] && reveals > 0) {
                    revealed[i] = true;
                    reveals--;
                    if (shownDir[i] !== dir) {
                        shownDir[i] = dir;
                        this['s' + i] = SPIKE_SRC[dir];
                    }
                } else if (revealed[i] && shownDir[i] !== dir && swaps > 0) {
                    swaps--;
                    shownDir[i] = dir;
                    this['s' + i] = SPIKE_SRC[dir];
                    nextSwap = (i + 1) % SPIKES;
                }
                if (revealed[i]) {
                    x = Math.round(MID + Math.cos(a) * SPIKE_RADIUS - SPIKE_HALF);
                    y = Math.round(MID + Math.sin(a) * SPIKE_RADIUS - SPIKE_HALF);
                }
            }
            if (shownX[i] !== x) {
                shownX[i] = x;
                this['x' + i] = x;
            }
            if (shownY[i] !== y) {
                shownY[i] = y;
                this['y' + i] = y;
            }
        }
    },
    // A touch that starts the game, or null when it should do nothing more: the game is still
    // loading, or it was just lost and the player is probably still holding.
    pressAt(e) {
        if (!loaded) {
            return null;
        }
        if (phase === 'over') {
            if (Date.now() < overUntil) {
                return null;
            }
            this.score = '0';
            drawnSpin = null;
            this.draw();
        }
        const x = e && typeof e.globalX === 'number' ? e.globalX : MID;
        return x < MID ? -1 : 1;
    },
    // Lite has no press or release event for a finger that stays still: touchstart, touchmove
    // and touchend only come once the finger has moved a little (a drag), longpress comes while
    // a still finger is held but nothing comes when it lifts, and click comes on lifting a
    // short still touch. So a held finger that moves turns the arena until it lifts, and a
    // still tap or long press turns it one step (TAP_TURN).
    touchStart(e) {
        const side = this.pressAt(e);
        if (side === null) {
            return;
        }
        hold = side;
        if (phase !== 'play') {
            this.start();
        }
    },
    touchMove(e) {
        if (hold !== 0 && e && typeof e.globalX === 'number') {
            hold = e.globalX < MID ? -1 : 1;
        }
    },
    touchEnd() {
        hold = 0;
    },
    step(e) {
        const side = this.pressAt(e);
        if (side === null) {
            return;
        }
        if (phase === 'play') {
            pendingTurn += side * TAP_TURN;
        } else {
            this.start();
        }
    }
};
