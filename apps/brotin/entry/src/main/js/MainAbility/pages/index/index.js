import storage from '@system.storage';
import {
    GAME_LIVES, GOLD_HITS, FACE_ROW, ADULTS, VISITORS, newPet, serialize, deserialize, isNight, advance, dayNumber, rollDay,
    rollVisitor, receiveVisitor, canChangePot, nextPot, potImage, takePotNews, potGoal, takeWishNews, isRipe, plantSeed, water, giveSun, clean, stroke, sparkMs, sparkKind,
    finishGame, faceFor, hintFor, greeting, idleLine, skyFor, formName, isFound, foundCount, herbariumHint, herbariumLine, herbariumPlace, ageText, hit
} from './pet.js';

const SAVE_KEY = 'pet';
const MS_PER_MIN = 60000;
const TICK_MS = 1000;
const ADVANCE_TICKS = 30;
const SAVE_TICKS = 600;
const BLINK_TICKS = 5;
const HAPPY_MS = 1200;
const MESSAGE_MS = 2000;
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
const VISITOR_TOP = 130;
const BAR_WIDTH = 150;
const LOCKED_SRC = '/common/mini_locked.png';
const EVENT_TEXT = {
    sprout: '¡Brotó!',
    young: '¡Está creciendo!',
    flower: '¡Es una flor!',
    sunflower: '¡Es un girasol!',
    lily: '¡Es un lirio!',
    golden: '¡Una flor dorada!',
    cactus: '¡Es un cactus!',
    mushroom: '¡Es un hongo!',
    discovered: 'Nueva en el herbario',
    ripe: '¡Tiene una semilla!',
    reseed: 'Se marchitó. Nueva semilla'
};

let pet = null;
let tickTimer = null;
let happyTimer = null;
let messageTimer = null;
let sparkTimer = null;
let ticks = 0;
let happy = false;
let message = '';
let queued = [];
let refusing = false;
let hits = 0;
let lives = 0;
let sparkOn = false;
let kind = 'spark';
let plantArmed = false;
let herbPick = -1;

function hourOf(ms) {
    return new Date(ms).getHours();
}

function today() {
    const date = new Date();
    return dayNumber(date.getFullYear(), date.getMonth(), date.getDate());
}

function barWidth(value) {
    return Math.max(4, Math.round(value * BAR_WIDTH / 100));
}

export default {
    data: {
        view: 'main',
        sky: skyFor(12),
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
        potSrc: '/common/pot.png',
        seedShown: false,
        visitorShown: false,
        visitorSrc: '/common/visitor_butterfly.png',
        visitorTop: VISITOR_TOP,
        fxShown: false,
        fxSrc: '/common/fx_heart.png',
        sparkShown: false,
        sparkSrc: '/common/spark.png',
        sparkX: 0,
        sparkY: 0,
        statusForm: '',
        statusAge: '',
        statusWater: '',
        statusSun: '',
        statusMood: '',
        statusHealth: '',
        statusGeneration: '',
        statusRecord: '',
        herbariumTitle: '',
        herbariumHint: '',
        herbariumPot: '',
        herb0: LOCKED_SRC,
        herb1: LOCKED_SRC,
        herb2: LOCKED_SRC,
        herb3: LOCKED_SRC,
        herb4: LOCKED_SRC,
        herb5: LOCKED_SRC
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
        const awayMin = (Date.now() - pet.last) / MS_PER_MIN;
        this.catchUp();
        const hello = greeting(hourOf(Date.now()), awayMin, this.night());
        if (hello && !message) {
            this.say(hello);
            this.refresh();
        }
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
            const texts = result.events.map((event) => EVENT_TEXT[event]);
            this.say(texts[0], texts.slice(1));
            this.save();
        }
        rollDay(pet, today(), Math.random);
        rollVisitor(pet, Date.now(), this.night(), Math.random);
        this.tellNews();
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
        this.sky = skyFor(hourOf(Date.now()));
        this.waterW = barWidth(pet.water);
        this.sunW = barWidth(pet.sun);
        this.moodW = barWidth(pet.mood);
        this.petSrc = '/common/form_' + pet.form + '.png';
        this.pest0 = pet.bugs > 0;
        this.pest1 = pet.bugs > 1;
        this.pest2 = pet.bugs > 2;
        this.potSrc = '/common/' + potImage(pet) + '.png';
        this.seedShown = isRipe(pet);
        this.visitorShown = pet.visitor > 0 && this.view !== 'game';
        if (pet.visitor > 0) {
            this.visitorSrc = '/common/visitor_' + VISITORS[pet.visitor - 1] + '.png';
        }
        if (this.view !== 'game') {
            this.note = message || hintFor(pet, night) || idleLine(pet, Math.floor(ticks / ADVANCE_TICKS));
        }
        this.drawPet();
    },
    // The breathing and the blink: only positions and the face change, once per tick.
    drawPet() {
        const bob = ticks % 2 === 0 ? 0 : BOB;
        const blink = ticks % BLINK_TICKS === 0;
        this.petTop = PET_TOP + bob;
        if (pet.visitor > 0) {
            this.visitorTop = VISITOR_TOP + BOB - bob;
        }
        this.faceTop = PET_TOP + FACE_ROW[pet.form] * CELL + bob;
        const face = happy ? 'happy' : faceFor(pet, this.night(), blink);
        this.faceSrc = '/common/face_' + face + '.png';
    },
    say(text, more) {
        clearTimeout(messageTimer);
        queued = more || [];
        refusing = false;
        this.showMessage(text);
    },
    // A message that the next action done replaces, so it does not seem to answer that action.
    refuse(text) {
        this.say(text);
        refusing = true;
    },
    // Each queued message follows from the timer of the last, which must not clear itself.
    showMessage(text) {
        message = text;
        messageTimer = setTimeout(() => {
            if (queued.length > 0) {
                this.showMessage(queued.shift());
            } else {
                message = '';
                plantArmed = false;
            }
            this.refresh();
        }, MESSAGE_MS);
    },
    // The happy face, and over the pet's head the sign of what it just got.
    cheer(fx) {
        if (refusing) {
            clearTimeout(messageTimer);
            message = '';
            refusing = false;
        }
        happy = true;
        this.fxSrc = '/common/fx_' + fx + '.png';
        this.fxShown = true;
        clearTimeout(happyTimer);
        happyTimer = setTimeout(() => {
            happy = false;
            this.fxShown = false;
            this.drawPet();
        }, HAPPY_MS);
    },
    // The result of an action: a refusal to show, or '' if it was done.
    finishAction(refusal, fx) {
        if (refusal) {
            this.refuse(refusal);
        } else {
            this.cheer(fx);
            this.save();
            this.tellNews();
        }
        this.refresh();
    },
    // After whatever is being said, if anything. The game's note is its own, so its news waits.
    tellNews() {
        if (this.view === 'game') {
            return;
        }
        const wish = takeWishNews(pet);
        const pot = takePotNews(pet);
        if (pot) {
            this.save();
        }
        [wish, pot].forEach((news) => {
            if (news && message) {
                queued.push(news);
            } else if (news) {
                this.say(news);
            }
        });
    },
    // A stroke is too small to write to storage each time; the periodic save and closing keep it,
    // unless it grants the wish.
    tapPet() {
        const refusal = stroke(pet);
        this.cheer('heart');
        if (refusal) {
            this.refuse(refusal);
        }
        if (pet.wishGranted) {
            this.save();
        }
        this.tellNews();
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
            this.openHerbarium();
        } else if (this.view === 'herbarium') {
            this.tapHerbarium(x, y);
        } else if (this.view === 'game') {
            this.tapSpark(x, y);
        } else {
            this.tapMain(hit(x, y));
        }
    },
    tapMain(action) {
        if (action === 'seed') {
            this.tapSeed();
            return;
        }
        plantArmed = false;
        if (action === 'visitor') {
            this.tapVisitor();
        } else if (action === 'water') {
            this.finishAction(water(pet), 'drop');
        } else if (action === 'sun') {
            this.finishAction(giveSun(pet, this.night()), 'sun');
        } else if (action === 'clean') {
            this.finishAction(clean(pet), 'star');
        } else if (action === 'play') {
            if (this.night()) {
                this.finishAction('Está dormido');
            } else {
                this.startGame();
            }
        } else if (action === 'status') {
            this.openStatus();
        } else if (action === 'pot' && canChangePot(pet)) {
            nextPot(pet);
            this.save();
            this.refresh();
        } else if (action === 'pet' || action === 'pot') {
            if (this.night()) {
                this.finishAction('Está dormido');
            } else {
                this.tapPet();
            }
        }
    },
    tapVisitor() {
        const text = receiveVisitor(pet);
        if (text) {
            this.say(text);
            this.finishAction('', 'star');
        }
    },
    // Planting replaces the adult, so it takes a second tap while the question is showing.
    tapSeed() {
        if (!isRipe(pet)) {
            return;
        }
        if (plantArmed) {
            plantArmed = false;
            pet = plantSeed(pet, Date.now());
            this.say('¡Plantada! Generación ' + pet.generation);
            this.finishAction('', 'star');
        } else {
            this.refuse('Toca otra vez para plantar');
            plantArmed = true;
            this.refresh();
        }
    },
    // The images change only here, so a closed herbarium costs no image swaps.
    openHerbarium() {
        this.herbariumTitle = 'Herbario ' + foundCount(pet) + '/' + ADULTS.length;
        herbPick = -1;
        this.herbariumHint = herbariumHint(pet);
        this.herbariumPot = potGoal(pet);
        this.herb0 = this.herbSrc(0);
        this.herb1 = this.herbSrc(1);
        this.herb2 = this.herbSrc(2);
        this.herb3 = this.herbSrc(3);
        this.herb4 = this.herbSrc(4);
        this.herb5 = this.herbSrc(5);
        this.view = 'herbarium';
    },
    // A tap on an image tells about it; on the same one again, or outside, it closes.
    tapHerbarium(x, y) {
        const place = herbariumPlace(x, y);
        if (place < 0 || place === herbPick) {
            this.view = 'main';
        } else {
            herbPick = place;
            this.herbariumHint = herbariumLine(pet, place);
        }
    },
    herbSrc(place) {
        return isFound(pet, place) ? '/common/mini_' + ADULTS[place] + '.png' : LOCKED_SRC;
    },
    openStatus() {
        this.statusForm = formName(pet.form);
        this.statusAge = 'Edad: ' + ageText(pet.ageMin);
        this.statusWater = 'Agua: ' + Math.round(pet.water);
        this.statusSun = 'Sol: ' + Math.round(pet.sun);
        this.statusMood = 'Ánimo: ' + Math.round(pet.mood);
        this.statusHealth = 'Salud: ' + Math.round(pet.health);
        this.statusGeneration = 'Generación ' + pet.generation + ' · Plantas: ' + pet.blooms;
        this.statusRecord = 'Racha: ' + pet.streak + ' · Récord: ' + pet.best;
        this.view = 'status';
    },
    // The game: tap each spark before it goes, faster each time, until three get away.
    // Each hit lifts the mood at the end.
    startGame() {
        hits = 0;
        lives = GAME_LIVES;
        this.view = 'game';
        message = '';
        this.note = 'Atrapa las chispas';
        this.visitorShown = false;
        this.nextSpark();
    },
    nextSpark() {
        if (lives <= 0) {
            this.endGame();
            return;
        }
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * SPARK_RADIUS;
        this.sparkX = Math.round(CENTRE + radius * Math.cos(angle) - SPARK_SIZE / 2);
        this.sparkY = Math.round(CENTRE + radius * Math.sin(angle) - SPARK_SIZE / 2);
        kind = sparkKind(hits, Math.random);
        this.sparkSrc = '/common/' + kind + '.png';
        this.sparkShown = true;
        sparkOn = true;
        sparkTimer = setTimeout(() => this.missSpark(), sparkMs(hits));
    },
    // A bug that goes away costs nothing.
    missSpark() {
        if (kind !== 'spark_bug') {
            lives--;
            this.showScore();
        }
        this.hideSpark();
    },
    showScore() {
        this.note = hits + (hits === 1 ? ' chispa · ' : ' chispas · ') + lives + (lives === 1 ? ' vida' : ' vidas');
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
            if (kind === 'spark_bug') {
                lives--;
                this.note = '¡Un bicho! ' + lives + (lives === 1 ? ' vida' : ' vidas');
            } else {
                hits += kind === 'spark_gold' ? GOLD_HITS : 1;
                this.showScore();
            }
            clearTimeout(sparkTimer);
            this.hideSpark();
        }
    },
    endGame() {
        const record = finishGame(pet, hits);
        this.view = 'main';
        const result = record ? '¡Récord! ' + hits + ' chispas' : 'Atrapó ' + hits + ' · Récord ' + pet.best;
        this.say(result);
        this.finishAction('', 'star');
    }
};
