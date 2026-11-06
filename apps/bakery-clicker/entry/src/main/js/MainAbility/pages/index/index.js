import storage from '@system.storage';

// Saving on every tap or tick would write flash constantly; save once taps pause,
// and every few seconds while cookies are produced on their own.
const SAVE_DELAY_MS = 1000;
const SAVE_EVERY_TICKS = 10;
// Each tap shows its "+N" at a random spot on the cookie, below the curved count. The page has
// PLUS_SLOTS of them, reused in turn, so a few can fade at the same time. PLUS_MS matches
// the animation in index.css. The area keeps the 144x44 row inside the round screen.
const PLUS_SLOTS = 5;
const PLUS_MS = 1000;
const PLUS_X_MIN = 60;
const PLUS_X_MAX = 262;
const PLUS_Y_MIN = 180;
const PLUS_Y_MAX = 340;
// The count and the line under it are laid out letter by letter along the round top edge.
// Each letter is centred on a circle around the screen centre; width is its rough advance
// as a share of the font size, since lite cannot measure text. Lite cannot rotate text,
// so the letters stay upright.
const SCREEN_CENTRE = 233;
const COUNT_ARC = { radius: 215, font: 38, boxW: 44, boxH: 50 };
const SUB_ARC = { radius: 177, font: 30, boxW: 36, boxH: 40 };
const COUNT_DIGITS = 9;

// Every text the player sees, per language. Names in the tables below have one per language too.
const TEXTS = {
    en: {
        shop: 'Shop', upgrades: 'Upgrades', stats: 'Stats', awards: 'Awards', settings: 'Settings',
        perTap: '/tap', award: 'Award: ', away: ' away',
        statBaked: 'Cookies baked', statCps: 'Cookies per second', statTaps: 'Taps',
        statBuildings: 'Buildings', statTastier: 'Tastier taps', statGolden: 'Golden cookies',
        statAwards: 'Awards', statTime: 'Time played',
        theme: 'Theme',
        language: 'Language', languageName: 'English', reset: 'Reset game',
        resetTitle: 'Reset game?', resetDetail: 'All progress will be lost',
        cancel: 'Cancel', resetConfirm: 'Reset'
    },
    es: {
        shop: 'Tienda', upgrades: 'Mejoras', stats: 'Estadísticas', awards: 'Logros', settings: 'Ajustes',
        perTap: '/toque', award: 'Logro: ', away: ' al volver',
        statBaked: 'Galletas horneadas', statCps: 'Galletas por segundo', statTaps: 'Toques',
        statBuildings: 'Edificios', statTastier: 'Mejor toque', statGolden: 'Galletas doradas',
        statAwards: 'Logros', statTime: 'Tiempo jugado',
        theme: 'Tema',
        language: 'Idioma', languageName: 'Español', reset: 'Resetear partida',
        resetTitle: '¿Resetear partida?', resetDetail: 'Se perderá todo el progreso',
        cancel: 'Cancelar', resetConfirm: 'Resetear'
    }
};
const LANGUAGES = ['en', 'es'];

// The cookie the player taps. Each id has two pixel-art images in /common/themes/, scaled up with
// nearest neighbour because the watch blurs what it scales up: <id>.png (466 px, big
// cookie) and <id>_small.png (170 px, menu centre, theme list and settings row).
// The id is what the settings save, so ids must not change. The first one is the default.
const THEMES = [
    { id: 'classic', name: { en: 'A classic', es: 'Un clásico' } },
    { id: 'cookie', name: { en: 'A cookie', es: 'Una galleta' } },
    { id: 'donut', name: { en: 'Everyday', es: 'Para diario' } },
    { id: 'concha', name: { en: 'Concha', es: 'Concha' } },
    { id: 'gingerbread', name: { en: 'Gingerbread', es: 'Jengibre' } },
    { id: 'cinnamon', name: { en: 'For the cold', es: 'Para el frío' } },
    { id: 'skull', name: { en: 'Day of the Dead', es: 'Día de muertos' } },
    { id: 'rosca', name: { en: 'Kings\' Day', es: 'Día de reyes' } },
    { id: 'bunuelo', name: { en: 'Christmas', es: 'Navidad' } },
    { id: 'pan_de_muerto', name: { en: 'Pan de muerto', es: 'Pan de muerto' } }
];

function themePath(id, suffix) {
    return '/common/themes/' + id + (suffix || '') + '.png';
}

// tap: cookies added per tap per owned; cps: cookies per second per owned.
// building ones are sold in the shop, the rest in the upgrades view.
// The order is the save format ("owned" is a comma-separated count per entry), so only append.
const UPGRADES = [
    { name: { en: 'Tastier taps', es: 'Mejor toque' }, icon: 'finger', building: false, base: 15, tap: 1, cps: 0 },
    { name: { en: 'Cursor', es: 'Cursor' }, icon: 'cursor', building: true, base: 25, tap: 0, cps: 1 },
    { name: { en: 'Grandma', es: 'Abuela' }, icon: 'grandma', building: true, base: 150, tap: 0, cps: 5 },
    { name: { en: 'Farm', es: 'Granja' }, icon: 'farm', building: true, base: 1500, tap: 0, cps: 40 },
    { name: { en: 'Mine', es: 'Mina' }, icon: 'mine', building: true, base: 15000, tap: 0, cps: 250 }
];
const PRICE_GROWTH = 1.15;
// Offline earnings stop after this long away, so an old save does not give a huge jump.
const OFFLINE_MAX_S = 24 * 60 * 60;
// Messages in place of the rate (offline earnings, achievements) show one after another.
const NOTICE_MS = 3000;
// The golden cookie shows up every 45-120 s, stays 10 s, and a tap on it multiplies
// taps and production by 7 for 30 s.
const GOLDEN_MIN_S = 45;
const GOLDEN_MAX_S = 120;
const GOLDEN_STAY_S = 10;
const FRENZY_MULT = 7;
const FRENZY_S = 30;
// The list only exists once the view has rendered, so its crown focus is requested a bit later.
const FOCUS_DELAY_MS = 50;
// The only gesture is a swipe that starts this close to the left edge and goes towards the centre.
const EDGE_PX = 60;

// The awards grid: one tile per category. Icons are paths under /common/ without ".png".
const CATEGORIES = [
    { name: { en: 'Clicks', es: 'Toques' }, icon: 'awards/clicks' },
    { name: { en: 'Cookies', es: 'Galletas' }, icon: 'awards/cookies' },
    { name: { en: 'Buildings', es: 'Edificios' }, icon: 'awards/buildings' },
    { name: { en: 'Speed', es: 'Velocidad' }, icon: 'awards/production' },
    { name: { en: 'Golden', es: 'Doradas' }, icon: 'awards/golden' }
];
const GRID_COLUMNS = 3;

// s is the game: baked (cookies ever made), taps, golden (golden cookies tapped), owned, cps.
// An achievement is done when value(s) reaches goal; goals above 1 show a progress bar.
// cat is the index in CATEGORIES.
// The order is the save format ("achieved" is one 0/1 per entry), so only append.
const ACHIEVEMENTS = [
    { name: { en: 'First cookie', es: 'Primera galleta' }, detail: { en: 'Bake 1', es: 'Hornea 1' }, cat: 0, icon: 'awards/first', goal: 1, value: (s) => s.baked },
    { name: { en: 'Baker', es: 'Panadero' }, detail: { en: 'Bake 100', es: 'Hornea 100' }, cat: 1, icon: 'awards/baker', goal: 100, value: (s) => s.baked },
    { name: { en: 'Bakery', es: 'Panadería' }, detail: { en: 'Bake 1K', es: 'Hornea 1K' }, cat: 1, icon: 'awards/bakery', goal: 1e3, value: (s) => s.baked },
    { name: { en: 'Factory', es: 'Fábrica' }, detail: { en: 'Bake 100K', es: 'Hornea 100K' }, cat: 1, icon: 'awards/factory', goal: 1e5, value: (s) => s.baked },
    { name: { en: 'Empire', es: 'Imperio' }, detail: { en: 'Bake 1M', es: 'Hornea 1M' }, cat: 1, icon: 'awards/empire', goal: 1e6, value: (s) => s.baked },
    { name: { en: 'Fast finger', es: 'Dedo veloz' }, detail: { en: '1K taps', es: '1K toques' }, cat: 0, icon: 'awards/clicks', goal: 1e3, value: (s) => s.taps },
    { name: { en: 'First cursor', es: 'Primer cursor' }, detail: { en: 'Buy a Cursor', es: 'Compra un cursor' }, cat: 2, icon: 'shop/cursor', goal: 1, value: (s) => s.owned[1] },
    { name: { en: 'Granny', es: 'Abuelita' }, detail: { en: 'Buy a Grandma', es: 'Compra una abuela' }, cat: 2, icon: 'shop/grandma', goal: 1, value: (s) => s.owned[2] },
    { name: { en: 'Farmer', es: 'Granjero' }, detail: { en: 'Buy a Farm', es: 'Compra una granja' }, cat: 2, icon: 'shop/farm', goal: 1, value: (s) => s.owned[3] },
    { name: { en: 'Miner', es: 'Minero' }, detail: { en: 'Buy a Mine', es: 'Compra una mina' }, cat: 2, icon: 'shop/mine', goal: 1, value: (s) => s.owned[4] },
    { name: { en: 'Rolling', es: 'En marcha' }, detail: { en: '10 / s', es: '10 / s' }, cat: 3, icon: 'awards/production', goal: 10, value: (s) => s.cps },
    { name: { en: 'Production', es: 'Producción' }, detail: { en: '100 / s', es: '100 / s' }, cat: 3, icon: 'awards/cps', goal: 100, value: (s) => s.cps },
    { name: { en: 'Lucky', es: 'Suertudo' }, detail: { en: '1 golden cookie', es: '1 galleta dorada' }, cat: 4, icon: 'awards/golden', goal: 1, value: (s) => s.golden },
    { name: { en: 'Gold digger', es: 'Buscaoro' }, detail: { en: '10 golden', es: '10 doradas' }, cat: 4, icon: 'awards/gold', goal: 10, value: (s) => s.golden }
];

function iconPath(icon) {
    return '/common/' + icon + '.png';
}

let saveTimer = null;
let plusSlot = 0;
// Where the last touch started, for the edge swipe; -1 when the event gave no position.
let touchX = -1;
let plusTimers = [];
let tickTimer = null;
let noticeTimer = null;
let notices = [];
let arcCount = '';
let arcSub = '';
let arcSubGold = false;
let ticks = 0;
let goldenIn = 0;
let goldenLeft = 0;
// Achievements are only checked once the save is loaded, so old ones are not announced again,
// and nothing is saved before that.
let loaded = false;

function nextGolden() {
    return GOLDEN_MIN_S + Math.floor(Math.random() * (GOLDEN_MAX_S - GOLDEN_MIN_S + 1));
}

function randomBetween(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function format(n) {
    const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (let i = 0; i < units.length; i++) {
        if (n >= units[i][0]) {
            return (Math.floor(n / units[i][0] * 10) / 10) + units[i][1];
        }
    }
    return String(n);
}

// The big count: up to COUNT_DIGITS digits with commas, then in thousands with K, M or B,
// and past 999,999,999B in scientific notation.
function formatCount(n) {
    const limit = Math.pow(10, COUNT_DIGITS);
    const units = ['', 'K', 'M', 'B'];
    let v = Math.floor(n);
    let i = 0;
    while (v >= limit && i < units.length - 1) {
        v = Math.floor(v / 1000);
        i++;
    }
    if (v >= limit) {
        return n.toExponential(2).replace('+', '');
    }
    let digits = String(v);
    let text = '';
    while (digits.length > 3) {
        text = ',' + digits.slice(-3) + text;
        digits = digits.slice(0, -3);
    }
    return digits + text + units[i];
}

function charWidth(c) {
    if (c === ',' || c === '.' || c === ' ' || c === ':') {
        return 0.3;
    }
    if (c === '/' || c === "'") {
        return 0.4;
    }
    if (c >= 'A' && c <= 'Z') {
        return c === 'M' || c === 'W' ? 0.85 : 0.72;
    }
    if (c === 'm' || c === 'w') {
        return 0.8;
    }
    if (c === 'i' || c === 'l' || c === 'j' || c === 'f' || c === 't' || c === 'r') {
        return 0.35;
    }
    return 0.58;
}

// One { c, x, y, gold } per letter of text, with x/y the left/top of its box.
function arcChars(text, arc, gold) {
    const widths = [];
    let total = 0;
    for (let i = 0; i < text.length; i++) {
        widths.push(charWidth(text.charAt(i)) * arc.font);
        total += widths[i];
    }
    const out = [];
    let at = -total / 2;
    for (let i = 0; i < text.length; i++) {
        const angle = (at + widths[i] / 2) / arc.radius;
        at += widths[i];
        out.push({
            c: text.charAt(i),
            gold: gold,
            x: Math.round(SCREEN_CENTRE + arc.radius * Math.sin(angle) - arc.boxW / 2),
            y: Math.round(SCREEN_CENTRE - arc.radius * Math.cos(angle) - arc.boxH / 2)
        });
    }
    return out;
}

// 1h 24m once past an hour, otherwise 5m 17s.
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60) % 60;
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (seconds % 60) + 's';
}

function load(key, fallback, callback) {
    storage.get({ key: key, default: fallback, success: callback, fail: () => callback(fallback) });
}

function numbers(value, length) {
    const parts = value.split(',');
    const result = [];
    for (let i = 0; i < length; i++) {
        result.push(parseInt(parts[i], 10) || 0);
    }
    return result;
}

export default {
    data: {
        view: 'cookie',
        menu: false,
        lang: 'en',
        t: TEXTS.en,
        theme: THEMES[0].id,
        themeItems: [],
        count: 0,
        countText: '0',
        countChars: [],
        subChars: [],
        baked: 0,
        taps: 0,
        goldenClicks: 0,
        playSeconds: 0,
        statItems: [],
        achieved: [],
        achievedText: '',
        awardRows: [],
        categoryTitle: '',
        categoryCount: '',
        categoryItems: [],
        owned: [0, 0, 0, 0, 0],
        tapPower: 1,
        cps: 0,
        rateText: '0 / s',
        noticeText: '',
        frenzyLeft: 0,
        frenzyText: '',
        golden: '',
        plusText: '+1',
        items: [],
        upgradeItems: [],
        cookieSrc: themePath(THEMES[0].id),
        cookieSmall: themePath(THEMES[0].id, '_small'),
        plus0: '', plus1: '', plus2: '', plus3: '', plus4: '',
        plusX0: 0, plusX1: 0, plusX2: 0, plusX3: 0, plusX4: 0,
        plusY0: 0, plusY1: 0, plusY2: 0, plusY3: 0, plusY4: 0
    },
    onInit() {
        this.achieved = ACHIEVEMENTS.map(() => false);
        this.setOwned(this.owned);
        goldenIn = nextGolden();
        // "language,theme", e.g. "en,concha". Settings are not part of the game,
        // so they load on their own and a reset keeps them.
        load('settings', '', (settings) => {
            const parts = settings.split(',');
            // Older saves had settings that no longer exist before the language
            // ("vibration,language,theme", and before that "sound,vibration,language").
            let i = 0;
            while (i < parts.length && LANGUAGES.indexOf(parts[i]) < 0) {
                i++;
            }
            this.setLanguage(i < parts.length ? parts[i] : 'en');
            this.setTheme(parts[i + 1]);
        });
        // Chained so the offline earnings use the loaded upgrades, and achievements
        // are checked against the whole save.
        load('owned', '', (owned) => {
            this.setOwned(numbers(owned, UPGRADES.length));
            load('count', '0', (count) => {
                // Add instead of assign so taps made before the read finishes are kept.
                this.setCount(this.count + (parseInt(count, 10) || 0));
                load('stats', '', (stats) => {
                    const s = numbers(stats, 4);
                    // Saves from before "stats" existed: count is the best guess for baked.
                    this.baked = Math.max(this.baked + s[0], this.count);
                    this.taps += s[1];
                    this.goldenClicks += s[2];
                    this.playSeconds += s[3];
                    load('achieved', '', (achieved) => {
                        this.achieved = ACHIEVEMENTS.map((a, i) => achieved.charAt(i) === '1');
                        load('savedAt', '0', (savedAt) => {
                            loaded = true;
                            this.addOfflineEarnings(parseInt(savedAt, 10) || 0);
                            this.checkAchievements();
                        });
                    });
                });
            });
        });
        tickTimer = setInterval(() => {
            this.tick();
        }, 1000);
    },
    onDestroy() {
        clearInterval(tickTimer);
        this.save();
    },
    // savedAt is when count was last saved, so the time since then is exactly what was not produced.
    addOfflineEarnings(savedAt) {
        const seconds = Math.floor((Date.now() - savedAt) / 1000);
        // No save yet, or the clock went backwards.
        if (savedAt <= 0 || seconds <= 0 || this.cps <= 0) {
            return;
        }
        const earned = this.cps * Math.min(seconds, OFFLINE_MAX_S);
        this.bake(earned);
        this.save();
        this.showNotice('+' + format(earned) + this.t.away);
    },
    showNotice(text) {
        notices.push(text);
        if (this.noticeText === '') {
            this.nextNotice();
        }
    },
    nextNotice() {
        this.noticeText = notices.length > 0 ? notices.shift() : '';
        this.updateArc();
        if (this.noticeText !== '') {
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => {
                this.nextNotice();
            }, NOTICE_MS);
        }
    },
    tick() {
        this.playSeconds++;
        if (this.cps > 0) {
            this.bake(this.cps * this.multiplier());
            ticks++;
            if (ticks % SAVE_EVERY_TICKS === 0) {
                this.save();
            }
        }
        this.tickGolden();
        if (this.view === 'stats') {
            this.refreshStats();
        }
    },
    tickGolden() {
        if (this.frenzyLeft > 0) {
            this.frenzyLeft--;
            this.frenzyText = this.frenzyLeft > 0 ? 'x' + FRENZY_MULT + '  ' + this.frenzyLeft + ' s' : '';
            this.updateRates();
            return;
        }
        if (this.golden !== '') {
            goldenLeft--;
            if (goldenLeft <= 0) {
                this.golden = '';
                goldenIn = nextGolden();
            }
            return;
        }
        // Only count down on the big cookie, so it never shows up unseen behind the shop or the menu.
        if (this.view !== 'cookie' || this.menu) {
            return;
        }
        goldenIn--;
        if (goldenIn <= 0) {
            this.golden = Math.random() < 0.5 ? 'left' : 'right';
            goldenLeft = GOLDEN_STAY_S;
        }
    },
    clickGolden() {
        this.golden = '';
        goldenIn = nextGolden();
        this.goldenClicks++;
        this.frenzyLeft = FRENZY_S;
        this.frenzyText = 'x' + FRENZY_MULT + '  ' + FRENZY_S + ' s';
        this.updateRates();
        this.checkAchievements();
    },
    multiplier() {
        return this.frenzyLeft > 0 ? FRENZY_MULT : 1;
    },
    increment() {
        this.taps++;
        this.bake(this.tapPower * this.multiplier());

        this.showPlus();

        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            this.save();
        }, SAVE_DELAY_MS);
    },
    // Moves the next slot to a random spot and swaps which of its two "if" texts exists, so a
    // new text is created and its animation starts again (lite cannot bind class). The slot is
    // removed once it has faded, since a text left on the cookie would still catch taps.
    showPlus() {
        const i = plusSlot;
        plusSlot = (plusSlot + 1) % PLUS_SLOTS;
        this['plusX' + i] = randomBetween(PLUS_X_MIN, PLUS_X_MAX);
        this['plusY' + i] = randomBetween(PLUS_Y_MIN, PLUS_Y_MAX);
        this['plus' + i] = this['plus' + i] === 'a' ? 'b' : 'a';
        clearTimeout(plusTimers[i]);
        plusTimers[i] = setTimeout(() => {
            this['plus' + i] = '';
        }, PLUS_MS);
    },
    // Lite touch events carry the position on the event itself (globalX), not in touches[].
    touchStart(e) {
        touchX = typeof e.globalX === 'number' ? e.globalX : -1;
    },
    // The app's only gesture: a swipe from the left edge towards the centre. On the cookie it
    // opens the menu, or closes it if it is open; elsewhere it goes back one screen.
    // Switching views inside the swipe event left the grid tiles ignoring taps in the
    // Previewer, so the view changes after the event ends.
    edgeSwipe(e) {
        if (e.direction !== 'right' || touchX < 0 || touchX > EDGE_PX) {
            return;
        }
        if (this.view === 'cookie') {
            this.menu = !this.menu;
            return;
        }
        setTimeout(() => {
            this.back();
        }, 0);
    },
    back() {
        if (this.view === 'category') {
            this.openAchievements();
        } else if (this.view === 'themes' || this.view === 'confirmReset') {
            this.openSettings();
        } else {
            this.closeView();
        }
    },
    closeMenu() {
        this.menu = false;
    },
    openStats() {
        this.menu = false;
        this.refreshStats();
        this.view = 'stats';
        this.focusCrown('statsList');
    },
    refreshStats() {
        let buildings = 0;
        UPGRADES.forEach((u, i) => {
            if (u.building) {
                buildings += this.owned[i];
            }
        });
        const awards = this.achieved.filter((a) => a).length;
        const t = this.t;
        const rows = [
            [t.statBaked, format(this.baked), 'baked'],
            [t.statCps, format(this.cps * this.multiplier()), 'cps'],
            [t.statTaps, format(this.taps), 'taps'],
            [t.statBuildings, String(buildings), 'buildings'],
            [t.statTastier, String(this.owned[0]), 'fingers'],
            [t.statGolden, String(this.goldenClicks), 'golden'],
            [t.statAwards, awards + ' / ' + ACHIEVEMENTS.length, 'awards'],
            [t.statTime, formatTime(this.playSeconds), 'time']
        ];
        this.statItems = rows.map((r) => ({ label: r[0], value: r[1], icon: iconPath('stats/' + r[2]) }));
    },
    openUpgrades() {
        this.menu = false;
        this.refreshItems();
        this.view = 'upgrades';
        this.focusCrown('upgradeList');
    },
    openShop() {
        this.menu = false;
        this.refreshItems();
        this.view = 'shop';
        this.focusCrown('shopList');
    },
    openAchievements() {
        this.menu = false;
        this.refreshAchievements();
        this.view = 'achievements';
        this.focusCrown('achievementList');
    },
    openCategory(id) {
        const state = this.gameState();
        let done = 0;
        const items = [];
        ACHIEVEMENTS.forEach((a, i) => {
            if (a.cat !== id) {
                return;
            }
            const value = Math.min(a.value(state), a.goal);
            if (this.achieved[i]) {
                done++;
            }
            items.push({
                icon: iconPath(a.icon),
                title: a.name[this.lang],
                detail: a.detail[this.lang],
                done: this.achieved[i],
                progress: !this.achieved[i] && a.goal > 1,
                percent: Math.floor(value * 100 / a.goal),
                progressText: format(Math.floor(value)) + ' / ' + format(a.goal)
            });
        });
        this.categoryItems = items;
        this.categoryTitle = CATEGORIES[id].name[this.lang];
        this.categoryCount = done + ' / ' + items.length;
        this.view = 'category';
        this.focusCrown('categoryList');
    },
    openSettings() {
        this.menu = false;
        this.view = 'settings';
        this.focusCrown('settingsList');
    },
    toggleLanguage() {
        this.setLanguage(LANGUAGES[(LANGUAGES.indexOf(this.lang) + 1) % LANGUAGES.length]);
        this.saveSettings();
    },
    // Lists that hold translated names are rebuilt, so they show the new language right away.
    setLanguage(lang) {
        this.lang = lang;
        this.t = TEXTS[lang];
        this.refreshItems();
        this.refreshStats();
        this.refreshAchievements();
        this.refreshThemes();
    },
    openThemes() {
        this.refreshThemes();
        this.view = 'themes';
        this.focusCrown('themeList');
    },
    // Rebuilt as a new array, like the shop, so the check moves to the chosen theme.
    // id is the index in THEMES, as with the shop.
    refreshThemes() {
        this.themeItems = THEMES.map((th, i) => ({
            id: i,
            icon: themePath(th.id, '_small'),
            title: th.name[this.lang],
            chosen: th.id === this.theme
        }));
    },
    chooseTheme(index) {
        this.setTheme(THEMES[index].id);
        this.saveSettings();
        this.openSettings();
    },
    // An unknown id (no theme saved yet, or one that was removed) falls back to the first theme.
    setTheme(id) {
        const theme = THEMES.some((th) => th.id === id) ? id : THEMES[0].id;
        this.theme = theme;
        this.cookieSrc = themePath(theme);
        this.cookieSmall = themePath(theme, '_small');
        this.refreshThemes();
    },
    saveSettings() {
        storage.set({ key: 'settings', value: [this.lang, this.theme].join(',') });
    },
    openResetConfirm() {
        this.view = 'confirmReset';
    },
    cancelReset() {
        this.openSettings();
    },
    // Back to a new game. Settings are kept.
    confirmReset() {
        notices = [];
        this.noticeText = '';
        this.frenzyLeft = 0;
        this.frenzyText = '';
        this.golden = '';
        goldenIn = nextGolden();
        this.baked = 0;
        this.taps = 0;
        this.goldenClicks = 0;
        this.playSeconds = 0;
        this.achieved = ACHIEVEMENTS.map(() => false);
        this.setOwned(UPGRADES.map(() => 0));
        this.setCount(0);
        this.save();
        this.view = 'cookie';
    },
    // Turning the crown scrolls the list that has the crown focus.
    focusCrown(ref) {
        setTimeout(() => {
            const list = this.$refs[ref];
            if (list && list.rotation) {
                list.rotation({ focus: true });
            }
        }, FOCUS_DELAY_MS);
    },
    closeView() {
        this.view = 'cookie';
    },
    buy(index) {
        const price = this.price(index);
        if (this.count < price) {
            return;
        }
        const owned = this.owned.slice();
        owned[index]++;
        this.count -= price;
        this.setOwned(owned);
        this.setCount(this.count);
        this.save();
    },
    price(index) {
        return Math.floor(UPGRADES[index].base * Math.pow(PRICE_GROWTH, this.owned[index]));
    },
    // New cookies, as opposed to setCount, which also spends them.
    bake(n) {
        this.baked += n;
        this.setCount(this.count + n);
    },
    setCount(count) {
        this.count = count;
        this.countText = formatCount(count);
        this.updateArc();
        if (this.view === 'shop' || this.view === 'upgrades') {
            this.refreshItems();
        }
        this.checkAchievements();
    },
    setOwned(owned) {
        let tap = 1;
        let cps = 0;
        UPGRADES.forEach((u, i) => {
            tap += u.tap * owned[i];
            cps += u.cps * owned[i];
        });
        this.owned = owned;
        this.tapPower = tap;
        this.cps = cps;
        this.updateRates();
        this.refreshItems();
        this.checkAchievements();
    },
    updateRates() {
        this.plusText = '+' + format(this.tapPower * this.multiplier());
        this.rateText = format(this.cps * this.multiplier()) + ' / s';
        this.updateArc();
    },
    // The curved count and the line under it (a notice, else the frenzy, else the rate).
    // Rebuilt only when the text changes, as new arrays (see refreshItems).
    updateArc() {
        if (this.countText !== arcCount) {
            arcCount = this.countText;
            this.countChars = arcChars(arcCount, COUNT_ARC, false);
        }
        const gold = this.noticeText !== '' || this.frenzyText !== '';
        const sub = this.noticeText !== '' ? this.noticeText : (this.frenzyText !== '' ? this.frenzyText : this.rateText);
        if (sub !== arcSub || gold !== arcSubGold) {
            arcSub = sub;
            arcSubGold = gold;
            this.subChars = arcChars(sub, SUB_ARC, gold);
        }
    },
    gameState() {
        return { baked: this.baked, taps: this.taps, golden: this.goldenClicks, owned: this.owned, cps: this.cps };
    },
    checkAchievements() {
        if (!loaded) {
            return;
        }
        const state = this.gameState();
        const achieved = this.achieved.slice();
        let changed = false;
        ACHIEVEMENTS.forEach((a, i) => {
            if (!achieved[i] && a.value(state) >= a.goal) {
                achieved[i] = true;
                changed = true;
                this.showNotice(this.t.award + a.name[this.lang]);
            }
        });
        if (changed) {
            this.achieved = achieved;
            this.save();
        }
    },
    // Rebuilt as a new array: lite does not reliably notice changes inside array items.
    // id is the index in UPGRADES, which buy() needs because each view lists only some of them.
    refreshItems() {
        const items = [];
        const upgradeItems = [];
        UPGRADES.forEach((u, i) => {
            const price = this.price(i);
            const gain = u.tap > 0 ? '+' + u.tap + this.t.perTap : '+' + u.cps + '/s';
            (u.building ? items : upgradeItems).push({
                id: i,
                icon: '/common/shop/' + u.icon + '.png',
                title: u.name[this.lang],
                detail: gain + ' (' + this.owned[i] + ')',
                price: format(price),
                affordable: this.count >= price
            });
        });
        this.items = items;
        this.upgradeItems = upgradeItems;
    },
    // The grid is a list of rows of GRID_COLUMNS tiles, so it scrolls if categories are added.
    refreshAchievements() {
        const done = CATEGORIES.map(() => 0);
        const total = CATEGORIES.map(() => 0);
        ACHIEVEMENTS.forEach((a, i) => {
            total[a.cat]++;
            if (this.achieved[i]) {
                done[a.cat]++;
            }
        });
        const rows = [];
        CATEGORIES.forEach((c, i) => {
            if (i % GRID_COLUMNS === 0) {
                rows.push({ cats: [] });
            }
            rows[rows.length - 1].cats.push({ id: i, name: c.name[this.lang], icon: iconPath(c.icon), count: done[i] + ' / ' + total[i] });
        });
        this.awardRows = rows;
        this.achievedText = done.reduce((a, b) => a + b, 0) + ' / ' + ACHIEVEMENTS.length;
    },
    save() {
        clearTimeout(saveTimer);
        // Saving half-loaded state would overwrite the stored achievements and stats.
        if (!loaded) {
            return;
        }
        storage.set({ key: 'count', value: String(this.count) });
        storage.set({ key: 'owned', value: this.owned.join(',') });
        storage.set({ key: 'stats', value: [this.baked, this.taps, this.goldenClicks, this.playSeconds].join(',') });
        storage.set({ key: 'achieved', value: this.achieved.map((a) => (a ? '1' : '0')).join('') });
        storage.set({ key: 'savedAt', value: String(Date.now()) });
    }
};
