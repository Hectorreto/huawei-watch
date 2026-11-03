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
const WITHER_PER_MIN = 100 / 720;
const HEAL_PER_MIN = 0.2;
const HEAL_ABOVE = 40;
const SPROUT_MIN = 30;
const YOUNG_MIN = 720;
const ADULT_MIN = 2880;
const FLOWER_CARE = 70;
const CACTUS_CARE = 40;
// A long absence is worked out in at most this many steps, since the watch's JS is slow.
const MAX_STEPS = 200;
const GIVE = 35;
const FULL = 95;
const PET_MOOD = 3;
const CLEAN_MOOD = 5;
export const GAME_LIVES = 3;
const MOOD_PER_HIT = 6;
const SPARK_MS = 1100;
const SPARK_MS_PER_HIT = 40;
const SPARK_MIN_MS = 650;

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

// The row of each form's art where its face goes.
export const FACE_ROW = { seed: 13, sprout: 13, young: 13, flower: 6, cactus: 13, mushroom: 12 };

function clamp(value) {
    return Math.max(0, Math.min(100, value));
}

// What the player has earned stays when a new seed replaces the pet.
const KEPT = ['blooms', 'best', 'wishDay', 'wishKind', 'wishDone', 'doneDay', 'streak'];

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
        streak: 0
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
    'wishDone', 'doneDay', 'streak'];
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
    return pet;
}

export function isNight(hour) {
    return hour >= NIGHT_FROM || hour < NIGHT_TO;
}

function grow(pet, events) {
    let next = pet.form;
    if (pet.form === 'seed' && pet.ageMin >= SPROUT_MIN) {
        next = 'sprout';
    } else if (pet.form === 'sprout' && pet.ageMin >= YOUNG_MIN) {
        next = 'young';
    } else if (pet.form === 'young' && pet.ageMin >= ADULT_MIN) {
        const care = pet.careSum / pet.ageMin;
        if (care >= FLOWER_CARE) {
            next = 'flower';
        } else if (care >= CACTUS_CARE) {
            next = 'cactus';
        } else {
            next = 'mushroom';
        }
        pet.blooms++;
    }
    if (next !== pet.form) {
        pet.form = next;
        events.push(next);
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

    let troubles = 0;
    [pet.water, pet.sun, pet.mood].forEach((need) => {
        if (need <= 0) {
            troubles++;
        }
    });
    if (pet.bugs >= MAX_BUGS) {
        troubles++;
    }
    if (troubles > 0) {
        pet.health = clamp(pet.health - minutes * troubles * WITHER_PER_MIN);
    } else if (pet.water > HEAL_ABOVE && pet.sun > HEAL_ABOVE && pet.mood > HEAL_ABOVE) {
        pet.health = clamp(pet.health + minutes * HEAL_PER_MIN);
    }

    pet.ageMin += minutes;
    pet.careSum += minutes * (pet.water + pet.sun + pet.mood + pet.health) / 4;
}

// Moves the pet to now and returns what happened ('sprout', 'young', 'flower', 'cactus',
// 'mushroom', 'reseed'). If its health runs out, it leaves a new seed and is not lost for good:
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
        step(pet, minutes, isNight(hourOf(pet.last + (i + 0.5) * stepMs)), random);
        grow(pet, events);
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
        pet.mood = clamp(pet.mood + WISH_MOOD);
        pet.careSum += WISH_CARE * ADULT_MIN;
        pet.wishGranted = true;
    }
}

// The message for a wish just granted, once; '' if there is none.
export function takeWishNews(pet) {
    if (!pet.wishGranted) {
        return '';
    }
    pet.wishGranted = false;
    return '¡Antojo cumplido! Racha ' + pet.streak;
}

export function water(pet) {
    if (pet.water >= FULL) {
        return 'Ya no quiere agua';
    }
    pet.water = clamp(pet.water + GIVE);
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

export function stroke(pet) {
    pet.mood = clamp(pet.mood + PET_MOOD);
    progressWish(pet, WISH_STROKE, 1);
}

// How long a spark stays, shorter with each one caught.
export function sparkMs(hits) {
    return Math.max(SPARK_MIN_MS, SPARK_MS - hits * SPARK_MS_PER_HIT);
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
    if (wishPending(pet)) {
        const wish = WISHES[pet.wishKind];
        return 'Antojo: ' + wish.label + ' ' + pet.wishDone + '/' + wish.goal;
    }
    return '';
}

export function formName(form) {
    return {
        seed: 'Semilla',
        sprout: 'Brote',
        young: 'Retoño',
        flower: 'Flor',
        cactus: 'Cactus',
        mushroom: 'Hongo'
    }[form];
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
    return x > 130 && x < 336 && y < 360 ? 'pet' : '';
}
