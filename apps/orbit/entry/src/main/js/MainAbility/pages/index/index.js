import brightness from '@system.brightness';
import storage from '@system.storage';
import vibrator from '@system.vibrator';

// Órbita: a ball crosses a round arena; the crown (or a tap or drag on either half of the
// screen) turns the arena (its spikes and its diamond) around the centre, but not the ball. Diamonds score,
// spikes end the game. Positions are in px from the screen centre, angles in radians with
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
const BASE_SPEED = 185;        // px/s, plus SPEED_STEP per point up to MAX_SPEED
const SPEED_STEP = 2;
const MAX_SPEED = 300;
const FRAME_MS = 33;
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
const MIN_GROUPS = 2;          // the 10 spikes come in 2 to 5 groups...
const MAX_GROUPS = 5;
const MIN_GROUP_SIZE = 2;      // ...of at least 2 spikes each...
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
let spikesShown = false;
let spikeAngles = [];          // in the arena's own frame
let diamondR = 0;
let diamondA = 0;              // in the arena's own frame
let timer = null;
let lastTime = 0;
let overUntil = 0;
let drawnSpin = null;          // spin when the arena was last placed, null to force it
let immune = 0;                // s of immunity left

function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
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
        round3(spin % TWO_PI), spikesShown ? 1 : 0, round3(diamondR), round3(diamondA)];
    for (let i = 0; i < SPIKES; i++) {
        parts.push(round3(spikeAngles[i]));
    }
    parts.push(1); // format version
    storage.set({ key: SAVE_KEY, value: parts.join(',') });
}

function freshRound() {
    ballX = 0;
    ballY = 0;
    heading = rand(0, TWO_PI);
    curve = randSign() * rand(0.1, 0.3);
    spikesShown = false;
    spikeAngles = [];
    for (let i = 0; i < SPIKES; i++) {
        spikeAngles.push(0);
    }
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

// After each bounce the 10 spikes move to 2-5 groups of at least 2 at random places on the
// wall, anywhere, even where the ball is (the ball is immune for a moment, IMMUNE_TIME).
// Groups keep GROUP_SPACE between them when a few tries find room.
function moveSpikes() {
    const groups = MIN_GROUPS + Math.floor(Math.random() * (MAX_GROUPS - MIN_GROUPS + 1));
    const sizes = [];
    for (let g = 0; g < groups; g++) {
        sizes.push(MIN_GROUP_SIZE);
    }
    for (let left = SPIKES - groups * MIN_GROUP_SIZE; left > 0; left--) {
        sizes[Math.floor(Math.random() * groups)]++;
    }
    const centres = [];
    const halves = [];
    let n = 0;
    for (let g = 0; g < groups; g++) {
        const half = (sizes[g] - 1) * SPIKE_GAP / 2;
        let centre = 0;
        for (let tries = 0; tries < 20; tries++) {
            centre = rand(0, TWO_PI);
            let fits = true;
            for (let k = 0; k < centres.length; k++) {
                if (angleApart(centre, centres[k]) < half + halves[k] + GROUP_SPACE) {
                    fits = false;
                    break;
                }
            }
            if (fits) {
                break;
            }
        }
        centres.push(centre);
        halves.push(half);
        for (let j = 0; j < sizes[g]; j++) {
            spikeAngles[n++] = centre - half + j * SPIKE_GAP - spin;
        }
    }
    spikesShown = true;
    drawnSpin = null;
}

function touchesSpike() {
    if (!spikesShown) {
        return false;
    }
    for (let i = 0; i < SPIKES; i++) {
        const a = spikeAngles[i] + spin;
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

// The ball goes back the way it came, a little off: 3 to 11 degrees to either side, and
// with a new slight curve.
function bounce() {
    const hit = Math.atan2(ballY, ballX);
    const r = WALL - BALL_R - 0.5;
    ballX = Math.cos(hit) * r;
    ballY = Math.sin(hit) * r;
    heading += Math.PI + randSign() * rand(0.05, 0.2);
    // Never along the wall: keep it within about 60 degrees of straight in.
    const inward = hit + Math.PI;
    if (Math.cos(heading - inward) < 0.5) {
        heading = inward + rand(-0.5, 0.5);
    }
    heading %= TWO_PI;
    curve = randSign() * rand(0.1, 0.3);
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
        crownMax: CROWN_MAX,
        crownValue: CROWN_MID,
        y0: OFF, y1: OFF, y2: OFF, y3: OFF, y4: OFF, y5: OFF, y6: OFF, y7: OFF, y8: OFF, y9: OFF
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
            ballX = p[2];
            ballY = p[3];
            heading = p[4];
            curve = p[5];
            spin = p[6];
            spikesShown = p[7] === 1;
            diamondR = p[8];
            diamondA = p[9];
            spikeAngles = p.slice(10, 10 + SPIKES);
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
    // Places the ball every frame, and the spikes and the diamond only when the arena moved.
    draw() {
        const bx = Math.round(MID + ballX - BALL_R);
        const by = Math.round(MID + ballY - BALL_R);
        if (this.bx !== bx) {
            this.bx = bx;
        }
        if (this.by !== by) {
            this.by = by;
        }
        if (drawnSpin === spin) {
            return;
        }
        drawnSpin = spin;
        const ga = diamondA + spin;
        this.gx = Math.round(MID + Math.cos(ga) * diamondR - DIAMOND_HALF);
        this.gy = Math.round(MID + Math.sin(ga) * diamondR - DIAMOND_HALF);
        for (let i = 0; i < SPIKES; i++) {
            let x = OFF;
            let y = OFF;
            if (spikesShown) {
                const a = spikeAngles[i] + spin;
                x = Math.round(MID + Math.cos(a) * SPIKE_RADIUS - SPIKE_HALF);
                y = Math.round(MID + Math.sin(a) * SPIKE_RADIUS - SPIKE_HALF);
                let dir = Math.round(a / TWO_PI * SPIKE_DIRS) % SPIKE_DIRS;
                if (dir < 0) {
                    dir += SPIKE_DIRS;
                }
                if (this['s' + i] !== SPIKE_SRC[dir]) {
                    this['s' + i] = SPIKE_SRC[dir];
                }
            }
            if (this['x' + i] !== x) {
                this['x' + i] = x;
            }
            if (this['y' + i] !== y) {
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
