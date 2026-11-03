import storage from '@system.storage';
import {
    GAME_ROUNDS, FACE_ROW, newPet, serialize, deserialize, isNight, advance, water, giveSun, clean,
    stroke, finishGame, faceFor, hintFor, formName, ageText, hit
} from './pet.js';

const SAVE_KEY = 'pet';
const TICK_MS = 1000;
const ADVANCE_TICKS = 30;
const SAVE_TICKS = 600;
const BLINK_TICKS = 5;
const HAPPY_MS = 1200;
const MESSAGE_MS = 2000;
const SPARK_MS = 1100;
const SPARK_GAP_MS = 250;
const SPARK_SIZE = 72;
const SPARK_HIT = 62;
// Sparks appear inside this circle, so they stay on the round screen.
const SPARK_RADIUS = 130;
const CENTRE = 233;
const CELL = 9;
const PET_LEFT = 143;
const PET_TOP = 128;
const FACE_COL = 5;
const BOB = 6;
const BAR_WIDTH = 150;
const SKY_DAY = '#12303f';
const SKY_NIGHT = '#060913';
const EVENT_TEXT = {
    sprout: '¡Brotó!',
    young: '¡Está creciendo!',
    flower: '¡Es una flor!',
    cactus: '¡Es un cactus!',
    mushroom: '¡Es un hongo!',
    reseed: 'Se marchitó y dejó una semilla'
};

let pet = null;
let tickTimer = null;
let happyTimer = null;
let messageTimer = null;
let sparkTimer = null;
let ticks = 0;
let happy = false;
let message = '';
let hits = 0;
let round = 0;
let sparkOn = false;

function hourOf(ms) {
    return new Date(ms).getHours();
}

function barWidth(value) {
    return Math.max(4, Math.round(value * BAR_WIDTH / 100));
}

export default {
    data: {
        view: 'main',
        sky: SKY_DAY,
        waterW: BAR_WIDTH,
        sunW: BAR_WIDTH,
        moodW: BAR_WIDTH,
        note: '',
        petSrc: '/common/form_seed.png',
        petTop: PET_TOP,
        faceSrc: '/common/face_normal.png',
        faceLeft: PET_LEFT + FACE_COL * CELL,
        faceTop: PET_TOP,
        pest0: false,
        pest1: false,
        pest2: false,
        sparkShown: false,
        sparkX: 0,
        sparkY: 0,
        statusForm: '',
        statusAge: '',
        statusWater: '',
        statusSun: '',
        statusMood: '',
        statusHealth: '',
        statusGeneration: ''
    },
    onInit() {
        storage.get({
            key: SAVE_KEY,
            default: '',
            success: (value) => this.start(deserialize(value, Date.now())),
            fail: () => this.start(newPet(Date.now()))
        });
    },
    onDestroy() {
        clearInterval(tickTimer);
        clearTimeout(happyTimer);
        clearTimeout(messageTimer);
        clearTimeout(sparkTimer);
        tickTimer = null;
        if (pet) {
            this.save();
        }
    },
    start(loaded) {
        pet = loaded;
        this.catchUp();
        this.save();
        tickTimer = setInterval(() => this.tick(), TICK_MS);
    },
    save() {
        storage.set({ key: SAVE_KEY, value: serialize(pet) });
    },
    // Works out the time since the pet was last moved, also while the app was closed.
    catchUp() {
        const result = advance(pet, Date.now(), hourOf, Math.random);
        pet = result.pet;
        if (result.events.length > 0) {
            this.say(EVENT_TEXT[result.events[result.events.length - 1]]);
            this.save();
        }
        this.refresh();
    },
    tick() {
        ticks++;
        if (ticks % ADVANCE_TICKS === 0) {
            this.catchUp();
        }
        if (ticks % SAVE_TICKS === 0) {
            this.save();
        }
        this.drawPet();
    },
    night() {
        return isNight(hourOf(Date.now()));
    },
    // Everything that depends on the pet's state, not on the animation.
    refresh() {
        const night = this.night();
        this.sky = night ? SKY_NIGHT : SKY_DAY;
        this.waterW = barWidth(pet.water);
        this.sunW = barWidth(pet.sun);
        this.moodW = barWidth(pet.mood);
        this.petSrc = '/common/form_' + pet.form + '.png';
        this.pest0 = pet.bugs > 0;
        this.pest1 = pet.bugs > 1;
        this.pest2 = pet.bugs > 2;
        if (this.view !== 'game') {
            this.note = message || hintFor(pet, night);
        }
        this.drawPet();
    },
    // The breathing and the blink: only positions and the face change, once per tick.
    drawPet() {
        const bob = ticks % 2 === 0 ? 0 : BOB;
        const blink = ticks % BLINK_TICKS === 0;
        this.petTop = PET_TOP + bob;
        this.faceTop = PET_TOP + FACE_ROW[pet.form] * CELL + bob;
        const face = happy ? 'happy' : faceFor(pet, this.night(), blink);
        this.faceSrc = '/common/face_' + face + '.png';
    },
    say(text) {
        message = text;
        clearTimeout(messageTimer);
        messageTimer = setTimeout(() => {
            message = '';
            this.refresh();
        }, MESSAGE_MS);
    },
    cheer() {
        happy = true;
        clearTimeout(happyTimer);
        happyTimer = setTimeout(() => {
            happy = false;
            this.drawPet();
        }, HAPPY_MS);
    },
    // The result of an action: a refusal to show, or '' if it was done.
    finishAction(refusal) {
        if (refusal) {
            this.say(refusal);
        } else {
            this.cheer();
            this.save();
        }
        this.refresh();
    },
    // One full-screen div takes the taps, as in the maze; the click carries the position.
    tap(e) {
        if (!pet) {
            return;
        }
        const x = e && typeof e.globalX === 'number' ? e.globalX : CENTRE;
        const y = e && typeof e.globalY === 'number' ? e.globalY : CENTRE;
        if (this.view === 'status') {
            this.view = 'main';
        } else if (this.view === 'game') {
            this.tapSpark(x, y);
        } else {
            this.tapMain(hit(x, y));
        }
    },
    tapMain(action) {
        if (action === 'water') {
            this.finishAction(water(pet));
        } else if (action === 'sun') {
            this.finishAction(giveSun(pet, this.night()));
        } else if (action === 'clean') {
            this.finishAction(clean(pet));
        } else if (action === 'play') {
            if (this.night()) {
                this.finishAction('Está dormido');
            } else {
                this.startGame();
            }
        } else if (action === 'status') {
            this.openStatus();
        } else if (action === 'pet' && !this.night()) {
            stroke(pet);
            this.finishAction('');
        }
    },
    openStatus() {
        this.statusForm = formName(pet.form);
        this.statusAge = 'Edad: ' + ageText(pet.ageMin);
        this.statusWater = 'Agua: ' + Math.round(pet.water);
        this.statusSun = 'Sol: ' + Math.round(pet.sun);
        this.statusMood = 'Ánimo: ' + Math.round(pet.mood);
        this.statusHealth = 'Salud: ' + Math.round(pet.health);
        this.statusGeneration = 'Generación ' + pet.generation + ' · Plantas: ' + pet.blooms;
        this.view = 'status';
    },
    // The game: tap each spark before it goes. Each hit lifts the mood at the end.
    startGame() {
        hits = 0;
        round = 0;
        this.view = 'game';
        message = '';
        this.note = 'Atrapa las chispas';
        this.nextSpark();
    },
    nextSpark() {
        if (round >= GAME_ROUNDS) {
            this.endGame();
            return;
        }
        round++;
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * SPARK_RADIUS;
        this.sparkX = Math.round(CENTRE + radius * Math.cos(angle) - SPARK_SIZE / 2);
        this.sparkY = Math.round(CENTRE + radius * Math.sin(angle) - SPARK_SIZE / 2);
        this.sparkShown = true;
        sparkOn = true;
        sparkTimer = setTimeout(() => this.hideSpark(), SPARK_MS);
    },
    hideSpark() {
        sparkOn = false;
        this.sparkShown = false;
        sparkTimer = setTimeout(() => this.nextSpark(), SPARK_GAP_MS);
    },
    tapSpark(x, y) {
        if (!sparkOn) {
            return;
        }
        const dx = x - (this.sparkX + SPARK_SIZE / 2);
        const dy = y - (this.sparkY + SPARK_SIZE / 2);
        if (dx * dx + dy * dy <= SPARK_HIT * SPARK_HIT) {
            hits++;
            this.note = hits + ' de ' + GAME_ROUNDS;
            clearTimeout(sparkTimer);
            this.hideSpark();
        }
    },
    endGame() {
        finishGame(pet, hits);
        this.view = 'main';
        this.say('Atrapó ' + hits + ' de ' + GAME_ROUNDS);
        this.finishAction('');
    }
};
