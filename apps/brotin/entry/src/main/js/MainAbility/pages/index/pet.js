// The pet's rules, with no views or watch APIs, so they can run in Node. Time is passed in.

// Raise it to watch a whole life in the Previewer; 1 on the watch.
export const TIME_SCALE = 1;

const MS_PER_MIN = 60000;
const WATER_PER_MIN = 100 / 360;
const SUN_PER_MIN = 100 / 480;
const MOOD_PER_MIN = 100 / 600;
const MOOD_PER_BUG_PER_MIN = 0.05;
const BUG_PER_MIN = 1 / 180;
const MAX_BUGS = 3;
const NIGHT_RATE = 0.25;
const NIGHT_FROM = 22;
const NIGHT_TO = 7;
const WITHER_PER_MIN = 100 / 1440;
const HEAL_PER_MIN = 0.2;
const HEAL_ABOVE = 40;
const WEAK_HEALTH = 50;
const SPROUT_MIN = 30;
const YOUNG_MIN = 720;
const ADULT_MIN = 2880;
// An adult has a seed to plant a day after it matures, and stays until the player plants it.
const RIPE_MIN = 4320;
const GOLDEN_CARE = 87;
const FLOWER_CARE = 70;
const CACTUS_CARE = 50;
// A long absence is worked out in at most this many steps, since the watch's JS is slow.
const MAX_STEPS = 200;
const GIVE = 35;
const FULL = 95;
const PET_MOOD = 3;
// Stroking lifts the mood only this far; above it the game is what helps.
const STROKE_CAP = 60;
// Above this it does not ask to play, since a game would add little.
const WANTS_PLAY_BELOW = 90;
const CLEAN_MOOD = 5;
export const GAME_LIVES = 3;
const MOOD_PER_HIT = 6;
const SPARK_MS = 1100;
const SPARK_MS_PER_HIT = 40;
const SPARK_MIN_MS = 650;
// The first sparks are always plain, so a new game starts easy.
const PLAIN_SPARKS = 3;
const GOLD_CHANCE = 0.12;
const BUG_CHANCE = 0.15;
export const GOLD_HITS = 3;

// One wish a day, counted by what the player does. All can be done on any day, unlike cleaning,
// which needs a bug to have appeared.
const WISH_WATER = 0;
const WISH_SUN = 1;
const WISH_STROKE = 2;
const WISH_SPARKS = 3;
const WISHES = [
    { label: 'riego', goal: 2 },
    { label: 'sol', goal: 2 },
    { label: 'mimos', goal: 5 },
    { label: 'chispas', goal: 6 }
];
const WISH_MOOD = 15;
// Each wish granted lifts the care average of a pet that reaches adulthood by this much.
const WISH_CARE = 3;

// Now and then something comes by while the app is open, and stays until tapped.
const VISIT_GAP_MIN = 120;
const VISIT_CHANCE = 0.6;
const STAR_CHANCE = 0.1;
const VISIT_GIVE = 25;
const LADYBUG_MOOD = 10;
// pet.visitor is a place here plus 1; 0 is nobody. The star is last.
export const VISITORS = ['butterfly', 'cloud', 'ladybug', 'star'];

// Pots earned for good; pet.pot is a place here. Each also names its image.
const POT_STREAK = 3;
const POT_SPARKS = 15;
const POTS = [
    { image: 'pot', goal: '', earned: () => true },
    { image: 'pot_blue', goal: 'Maceta: racha de ' + POT_STREAK + ' días', earned: (pet) => pet.bestStreak >= POT_STREAK },
    { image: 'pot_pink', goal: 'Maceta: ' + POT_SPARKS + ' chispas', earned: (pet) => pet.best >= POT_SPARKS },
    { image: 'pot_gold', goal: 'Maceta: herbario completo', earned: (pet) => foundCount(pet) === ADULTS.length }
];

const GREET_AFTER_MIN = 30;
const MISSED_AFTER_MIN = 720;
const FORM_LINES = { seed: 'Sueña con brotar', sprout: 'Estira sus hojitas', young: 'Quiere crecer' };
const ADULT_LINE = 'Presume su forma';

const DAY_FROM = 9;
const DUSK_FROM = 17;
const EVENING_FROM = 20;
const SKY_DAWN = '#3a3350';
const SKY_DAY = '#12303f';
const SKY_DUSK = '#47304a';
const SKY_EVENING = '#1a2140';
const SKY_NIGHT = '#060913';

// The row of each form's art where its face goes.
export const FACE_ROW = {
    seed: 13, sprout: 13, young: 13, flower: 6, sunflower: 6, lily: 6, golden: 6, cactus: 13, mushroom: 12
};

// The herbarium, in the order it shows them. Each form's place is its bit in pet.found.
export const ADULTS = ['flower', 'sunflower', 'lily', 'golden', 'cactus', 'mushroom'];
const ADULT_HINTS = {
    flower: 'Pista: cuídalo bien',
    sunflower: 'Pista: más sol que agua',
    lily: 'Pista: doble agua que sol',
    golden: 'Pista: cuidado y antojos',
    cactus: 'Pista: cuidado a medias',
    mushroom: 'Pista: lo justo para vivir'
};

function clamp(value) {
    return Math.max(0, Math.min(100, value));
}

// What the player has earned stays when a new seed replaces the pet.
const KEPT = [
    'blooms', 'best', 'wishDay', 'wishKind', 'wishDone', 'doneDay', 'streak', 'found', 'lastVisit', 'visitor',
    'bestStreak', 'pot', 'potsSeen'
];

export function newPet(now, previous) {
    const pet = {
        form: 'seed',
        water: 70,
        sun: 70,
        mood: 70,
        health: 100,
        bugs: 0,
        ageMin: 0,
        careSum: 0,
        generation: previous ? previous.generation + 1 : 1,
        blooms: 0,
        last: now,
        best: 0,
        wishDay: 0,
        wishKind: 0,
        wishDone: 0,
        doneDay: 0,
        streak: 0,
        waters: 0,
        suns: 0,
        found: 0,
        lastVisit: now,
        visitor: 0,
        bestStreak: 0,
        pot: 0,
        potsSeen: 1
    };
    if (previous) {
        KEPT.forEach((field) => {
            pet[field] = previous[field];
        });
    }
    return pet;
}

// New fields go at the end: older saves simply lack them and they load as 0.
const FIELDS = ['water', 'sun', 'mood', 'health', 'bugs', 'ageMin', 'careSum', 'generation', 'blooms', 'last', 'best', 'wishDay', 'wishKind',
    'wishDone', 'doneDay', 'streak', 'waters', 'suns', 'found', 'lastVisit', 'visitor',
    'bestStreak', 'pot', 'potsSeen'];
const OLDEST_FIELDS = 10;

// "form,water,sun,..." with no JSON, as the other apps save.
export function serialize(pet) {
    return pet.form + ',' + FIELDS.map((field) => Math.round(pet[field])).join(',');
}

export function deserialize(text, now) {
    const parts = String(text || '').split(',');
    if (FACE_ROW[parts[0]] === undefined || parts.length < OLDEST_FIELDS + 1) {
        return newPet(now);
    }
    const pet = { form: parts[0] };
    for (let i = 0; i < FIELDS.length; i++) {
        pet[FIELDS[i]] = parseInt(parts[i + 1], 10) || 0;
    }
    pet.generation = Math.max(1, pet.generation);
    pet.bestStreak = Math.max(pet.bestStreak, pet.streak);
    pet.potsSeen = Math.max(1, pet.potsSeen);
    markFound(pet);
    return pet;
}

// Returns whether the pet's form is new to the herbarium. A save from before the herbarium may
// already hold an adult.
function markFound(pet) {
    const place = ADULTS.indexOf(pet.form);
    if (place < 0 || isFound(pet, place)) {
        return false;
    }
    pet.found |= 1 << place;
    return true;
}

export function isNight(hour) {
    return hour >= NIGHT_FROM || hour < NIGHT_TO;
}

function adultForm(pet) {
    const care = pet.careSum / pet.ageMin;
    if (care < CACTUS_CARE) {
        return 'mushroom';
    }
    if (care < FLOWER_CARE) {
        return 'cactus';
    }
    if (care >= GOLDEN_CARE) {
        return 'golden';
    }
    if (pet.suns > pet.waters) {
        return 'sunflower';
    }
    return pet.waters > 0 && pet.waters >= 2 * pet.suns ? 'lily' : 'flower';
}

function grow(pet, events) {
    let next = pet.form;
    if (pet.form === 'seed' && pet.ageMin >= SPROUT_MIN) {
        next = 'sprout';
    } else if (pet.form === 'sprout' && pet.ageMin >= YOUNG_MIN) {
        next = 'young';
    } else if (pet.form === 'young' && pet.ageMin >= ADULT_MIN) {
        next = adultForm(pet);
        pet.blooms++;
    }
    if (next !== pet.form) {
        pet.form = next;
        events.push(next);
        if (markFound(pet)) {
            events.push('discovered');
        }
    }
}

function step(pet, minutes, night, random) {
    const rate = night ? NIGHT_RATE : 1;
    pet.water = clamp(pet.water - minutes * rate * WATER_PER_MIN);
    if (!night) {
        pet.sun = clamp(pet.sun - minutes * SUN_PER_MIN);
        if (pet.bugs < MAX_BUGS && random() < minutes * BUG_PER_MIN) {
            pet.bugs++;
        }
    }
    pet.mood = clamp(pet.mood - minutes * (rate * MOOD_PER_MIN + pet.bugs * MOOD_PER_BUG_PER_MIN));

    if (pet.water <= 0 || pet.sun <= 0 || pet.mood <= 0 || pet.bugs >= MAX_BUGS) {
        pet.health = clamp(pet.health - minutes * WITHER_PER_MIN);
    } else if (pet.water > HEAL_ABOVE && pet.sun > HEAL_ABOVE && pet.mood > HEAL_ABOVE) {
        pet.health = clamp(pet.health + minutes * HEAL_PER_MIN);
    }

    pet.ageMin += minutes;
    pet.careSum += minutes * (pet.water + pet.sun + pet.mood + pet.health) / 4;
}

// Whether it is an adult with a seed ready to plant.
export function isRipe(pet) {
    return ADULTS.indexOf(pet.form) >= 0 && pet.ageMin >= RIPE_MIN;
}

// The ripe adult gives way to its seed; the herbarium keeps it.
export function plantSeed(pet, now) {
    return newPet(now, pet);
}

// Moves the pet to now and returns what happened ('sprout', 'young', an adult form, 'discovered'
// when that form is new to the herbarium, 'ripe', 'reseed'). If its health runs out, it leaves a new seed and is not lost for good:
// the generation goes up. hourOf(ms) gives the local hour; random() is as Math.random.
export function advance(pet, now, hourOf, random) {
    const events = [];
    if (now <= pet.last) {
        pet.last = now;
        return { pet, events };
    }
    const totalMin = (now - pet.last) * TIME_SCALE / MS_PER_MIN;
    const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(totalMin)));
    const minutes = totalMin / steps;
    const stepMs = (now - pet.last) / steps;
    for (let i = 0; i < steps; i++) {
        const wasRipe = isRipe(pet);
        step(pet, minutes, isNight(hourOf(pet.last + (i + 0.5) * stepMs)), random);
        grow(pet, events);
        if (!wasRipe && isRipe(pet)) {
            events.push('ripe');
        }
        if (pet.health <= 0) {
            events.push('reseed');
            return { pet: newPet(now, pet), events };
        }
    }
    pet.last = now;
    return { pet, events };
}

// A day's number from its local year, month (0-11) and date; consecutive days differ by 1.
export function dayNumber(year, month, date) {
    const y = month < 2 ? year - 1 : year;
    const m = (month + 10) % 12;
    return 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) +
        Math.floor((153 * m + 2) / 5) + date;
}

// Starts today's wish, never the same as the last one. A day with no wish granted ends the streak.
export function rollDay(pet, today, random) {
    if (pet.wishDay === today) {
        return;
    }
    if (pet.doneDay < today - 1) {
        pet.streak = 0;
    }
    pet.wishKind = (pet.wishKind + 1 + Math.floor(random() * (WISHES.length - 1))) % WISHES.length;
    pet.wishDay = today;
    pet.wishDone = 0;
}

function wishPending(pet) {
    return pet.doneDay !== pet.wishDay;
}

function progressWish(pet, kind, amount) {
    if (pet.wishKind !== kind || !wishPending(pet)) {
        return;
    }
    pet.wishDone += amount;
    if (pet.wishDone >= WISHES[kind].goal) {
        pet.doneDay = pet.wishDay;
        pet.streak++;
        pet.bestStreak = Math.max(pet.bestStreak, pet.streak);
        pet.mood = clamp(pet.mood + WISH_MOOD);
        pet.careSum += WISH_CARE * ADULT_MIN;
        pet.wishGranted = true;
    }
}

function earnedPots(pet) {
    return POTS.filter((pot) => pot.earned(pet)).length;
}

export function canChangePot(pet) {
    return earnedPots(pet) > 1;
}

// The next pot earned after the one in use.
export function nextPot(pet) {
    let place = pet.pot;
    do {
        place = (place + 1) % POTS.length;
    } while (!POTS[place].earned(pet));
    pet.pot = place;
}

export function potImage(pet) {
    const pot = POTS[pet.pot];
    return pot ? pot.image : POTS[0].image;
}

// The message for a pot just earned, once; '' if there is none. A save that already earned one
// tells it on opening.
export function takePotNews(pet) {
    const earned = earnedPots(pet);
    if (earned <= pet.potsSeen) {
        return '';
    }
    pet.potsSeen = earned;
    return '¡Maceta nueva! Tócala';
}

// What the next pot takes; '' once all are earned.
export function potGoal(pet) {
    const missing = POTS.filter((pot) => !pot.earned(pet));
    return missing.length > 0 ? missing[0].goal : '';
}

// The message for a wish just granted, once; '' if there is none.
export function takeWishNews(pet) {
    if (!pet.wishGranted) {
        return '';
    }
    pet.wishGranted = false;
    return '¡Antojo cumplido! Racha ' + pet.streak;
}

// At most one roll per gap, so the 30 s tick cannot keep trying until one comes. Asleep, nobody
// comes. A clock moved backwards just rolls again.
export function rollVisitor(pet, now, night, random) {
    const gap = now - pet.lastVisit;
    if (night || pet.visitor > 0 || (gap >= 0 && gap * TIME_SCALE < VISIT_GAP_MIN * MS_PER_MIN)) {
        return;
    }
    pet.lastVisit = now;
    if (random() < VISIT_CHANCE) {
        const star = VISITORS.length;
        pet.visitor = random() < STAR_CHANCE ? star : 1 + Math.floor(random() * (star - 1));
    }
}

// What the visitor does when tapped, and what to say about it; '' if nobody is there.
export function receiveVisitor(pet) {
    const name = VISITORS[pet.visitor - 1];
    pet.visitor = 0;
    if (name === 'butterfly') {
        pet.mood = clamp(pet.mood + VISIT_GIVE);
        return '¡Una mariposa lo alegra!';
    }
    if (name === 'cloud') {
        pet.water = clamp(pet.water + VISIT_GIVE);
        return '¡Una nube lo riega!';
    }
    if (name === 'ladybug') {
        pet.bugs = 0;
        pet.mood = clamp(pet.mood + LADYBUG_MOOD);
        return '¡La mariquita come bichos!';
    }
    if (name === 'star') {
        pet.mood = clamp(pet.mood + VISIT_GIVE);
        progressWish(pet, pet.wishKind, WISHES[pet.wishKind].goal);
        return '¡Una estrella fugaz!';
    }
    return '';
}

export function water(pet) {
    if (pet.water >= FULL) {
        return 'Ya no quiere agua';
    }
    pet.water = clamp(pet.water + GIVE);
    pet.waters++;
    progressWish(pet, WISH_WATER, 1);
    return '';
}

export function giveSun(pet, night) {
    if (night) {
        return 'Está dormido';
    }
    if (pet.sun >= FULL) {
        return 'Ya tiene sol';
    }
    pet.sun = clamp(pet.sun + GIVE);
    pet.suns++;
    progressWish(pet, WISH_SUN, 1);
    return '';
}

export function clean(pet) {
    if (pet.bugs === 0) {
        return 'No hay bichos';
    }
    pet.bugs = 0;
    pet.mood = clamp(pet.mood + CLEAN_MOOD);
    return '';
}

// It always counts for the wish. Returns what to say if it did nothing at all, as the actions do.
export function stroke(pet) {
    const gained = pet.mood < STROKE_CAP;
    const wished = pet.wishKind === WISH_STROKE && wishPending(pet);
    if (gained) {
        pet.mood = Math.min(STROKE_CAP, pet.mood + PET_MOOD);
    }
    progressWish(pet, WISH_STROKE, 1);
    return !gained && !wished && pet.mood < WANTS_PLAY_BELOW ? 'Quiere jugar' : '';
}

// How long a spark stays, shorter with each one caught.
export function sparkMs(hits) {
    return Math.max(SPARK_MIN_MS, SPARK_MS - hits * SPARK_MS_PER_HIT);
}

// What comes next in the game, also the name of its image: a plain spark, a golden one worth more,
// or a bug that costs a life if tapped and nothing if left alone.
export function sparkKind(hits, random) {
    if (hits < PLAIN_SPARKS) {
        return 'spark';
    }
    const roll = random();
    if (roll < GOLD_CHANCE) {
        return 'spark_gold';
    }
    return roll < GOLD_CHANCE + BUG_CHANCE ? 'spark_bug' : 'spark';
}

// Returns whether this game beat the record.
export function finishGame(pet, hits) {
    pet.mood = clamp(pet.mood + hits * MOOD_PER_HIT);
    progressWish(pet, WISH_SPARKS, hits);
    if (hits > pet.best) {
        pet.best = hits;
        return true;
    }
    return false;
}

// What the pet's face shows when nothing has just happened.
export function faceFor(pet, night, blink) {
    if (night) {
        return 'sleep';
    }
    if (pet.health < 35) {
        return 'sick';
    }
    if (pet.water < 25 || pet.sun < 25 || pet.mood < 25 || pet.bugs >= 2) {
        return 'sad';
    }
    return blink ? 'blink' : 'normal';
}

// The line under the bars when nothing has just happened.
export function hintFor(pet, night) {
    if (night) {
        return 'Zzz...';
    }
    if (pet.bugs >= 2) {
        return 'Tiene bichos';
    }
    if (pet.water < 25) {
        return 'Tiene sed';
    }
    if (pet.sun < 25) {
        return 'Quiere sol';
    }
    if (pet.mood < 25) {
        return 'Está triste';
    }
    if (pet.health < WEAK_HEALTH) {
        return pet.water > HEAL_ABOVE && pet.sun > HEAL_ABOVE && pet.mood > HEAL_ABOVE ?
            'Se está curando' : 'Para curarse, llena todo';
    }
    if (wishPending(pet)) {
        const wish = WISHES[pet.wishKind];
        return 'Antojo: ' + wish.label + ' ' + pet.wishDone + '/' + wish.goal;
    }
    return isRipe(pet) ? 'Toca la semilla para plantar' : '';
}

// What it says on opening, after a while away; '' if it is asleep or was just opened.
export function greeting(hour, awayMin, night) {
    if (night || awayMin < GREET_AFTER_MIN) {
        return '';
    }
    if (awayMin >= MISSED_AFTER_MIN) {
        return '¡Te extrañé!';
    }
    if (hour < 12) {
        return 'Buenos días';
    }
    return hour < 19 ? 'Buenas tardes' : 'Buenas noches';
}

// The note when nothing else needs saying; step changes which line it is.
export function idleLine(pet, step) {
    const lines = [FORM_LINES[pet.form] || ADULT_LINE, 'Se siente bien', 'Mira el cielo', 'Tararea bajito'];
    if (pet.streak >= 2) {
        lines.push('Racha de ' + pet.streak + ' días');
    }
    if (pet.found > 0) {
        lines.push('Herbario ' + foundCount(pet) + '/' + ADULTS.length);
    }
    return lines[step % lines.length];
}

export function skyFor(hour) {
    if (isNight(hour)) {
        return SKY_NIGHT;
    }
    if (hour < DAY_FROM) {
        return SKY_DAWN;
    }
    if (hour < DUSK_FROM) {
        return SKY_DAY;
    }
    return hour < EVENING_FROM ? SKY_DUSK : SKY_EVENING;
}

export function formName(form) {
    return {
        seed: 'Semilla',
        sprout: 'Brote',
        young: 'Retoño',
        flower: 'Flor',
        sunflower: 'Girasol',
        lily: 'Lirio',
        golden: 'Flor dorada',
        cactus: 'Cactus',
        mushroom: 'Hongo'
    }[form];
}

export function isFound(pet, place) {
    return (pet.found & (1 << place)) !== 0;
}

export function foundCount(pet) {
    return ADULTS.filter((form, place) => isFound(pet, place)).length;
}

// The clue to the first form still missing from the herbarium.
export function herbariumHint(pet) {
    const missing = ADULTS.filter((form, place) => !isFound(pet, place));
    return missing.length > 0 ? ADULT_HINTS[missing[0]] : '¡Herbario completo!';
}

// A form's name if found, its clue if not.
export function herbariumLine(pet, place) {
    const form = ADULTS[place];
    return isFound(pet, place) ? formName(form) : ADULT_HINTS[form];
}

export function ageText(ageMin) {
    const hours = Math.floor(ageMin / 60);
    if (hours < 1) {
        return Math.floor(ageMin) + ' min';
    }
    if (hours < 48) {
        return hours + ' h';
    }
    return Math.floor(hours / 24) + ' días';
}

const BUTTONS = [
    { action: 'water', x: 80, y: 328 },
    { action: 'sun', x: 171, y: 402 },
    { action: 'play', x: 295, y: 402 },
    { action: 'clean', x: 386, y: 328 }
];
const BUTTON_RADIUS = 48;
const STATUS_BOTTOM = 110;
const SEED_X = 104;
const SEED_Y = 190;
const SEED_RADIUS = 44;
const VISITOR_X = 373;
const VISITOR_Y = 157;
const VISITOR_RADIUS = 44;
const POT_LEFT = 170;
const POT_RIGHT = 296;
const POT_TOP = 296;
const POT_BOTTOM = 359;

// Which image of the herbarium's 3 x 2 grid a tap is on, or -1. The view is a centred column, so
// these follow from the heights in index.css.
const HERB_LEFT = 119;
const HERB_TOP = 143;
const HERB_CELL_W = 76;
const HERB_CELL_H = 72;
const HERB_COLS = 3;
const HERB_ROWS = 2;

export function herbariumPlace(x, y) {
    const col = Math.floor((x - HERB_LEFT) / HERB_CELL_W);
    const row = Math.floor((y - HERB_TOP) / HERB_CELL_H);
    if (col < 0 || col >= HERB_COLS || row < 0 || row >= HERB_ROWS) {
        return -1;
    }
    return row * HERB_COLS + col;
}

// What a tap at x, y on the main view means. The pet is everything left between the buttons.
export function hit(x, y) {
    for (let i = 0; i < BUTTONS.length; i++) {
        const b = BUTTONS[i];
        const dx = x - b.x;
        const dy = y - b.y;
        if (dx * dx + dy * dy <= BUTTON_RADIUS * BUTTON_RADIUS) {
            return b.action;
        }
    }
    if (y < STATUS_BOTTOM) {
        return 'status';
    }
    const sx = x - SEED_X;
    const sy = y - SEED_Y;
    if (sx * sx + sy * sy <= SEED_RADIUS * SEED_RADIUS) {
        return 'seed';
    }
    const vx = x - VISITOR_X;
    const vy = y - VISITOR_Y;
    if (vx * vx + vy * vy <= VISITOR_RADIUS * VISITOR_RADIUS) {
        return 'visitor';
    }
    if (x >= POT_LEFT && x <= POT_RIGHT && y >= POT_TOP && y <= POT_BOTTOM) {
        return 'pot';
    }
    return x > 130 && x < 336 && y < 360 ? 'pet' : '';
}
