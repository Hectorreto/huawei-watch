import storage from '@system.storage';
import vibrator from '@system.vibrator';
// Not in the Lite Wearable SDK typings; it compiles to requireModule('@system.audio'), which is
// empty if the watch has no such module, so the tap sound is only tried when it exists.
import audio from '@system.audio';

const COOKIE = '/common/cookie.png';
const COOKIE_PRESSED = '/common/cookie_pressed.png';
const PRESS_MS = 120;
const CLICK_SOUND = '/common/click.wav';
// Saving on every tap or tick would write flash constantly; save once taps pause,
// and every few seconds while cookies are produced on their own.
const SAVE_DELAY_MS = 1000;
const SAVE_EVERY_TICKS = 10;

// Every text the player sees, per language. Names in the tables below have one per language too.
const TEXTS = {
    en: {
        shop: 'Shop', upgrades: 'Upgrades', stats: 'Stats', awards: 'Awards', settings: 'Settings',
        perTap: '/tap', award: 'Award: ', away: ' away',
        statBaked: 'Cookies baked', statCps: 'Cookies per second', statTaps: 'Taps',
        statBuildings: 'Buildings', statTastier: 'Tastier taps', statGolden: 'Golden cookies',
        statAwards: 'Awards', statTime: 'Time played',
        sound: 'Sound', vibration: 'Vibration', theme: 'Theme', classic: 'Classic',
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
        sound: 'Sonido', vibration: 'Vibración', theme: 'Tema', classic: 'Clásico',
        language: 'Idioma', languageName: 'Español', reset: 'Resetear partida',
        resetTitle: '¿Resetear partida?', resetDetail: 'Se perderá todo el progreso',
        cancel: 'Cancelar', resetConfirm: 'Resetear'
    }
};
const LANGUAGES = ['en', 'es'];

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

let pressTimer = null;
let saveTimer = null;
let tickTimer = null;
let noticeTimer = null;
let notices = [];
let ticks = 0;
let goldenIn = 0;
let goldenLeft = 0;
// Achievements are only checked once the save is loaded, so old ones are not announced again,
// and nothing is saved before that.
let loaded = false;

function nextGolden() {
    return GOLDEN_MIN_S + Math.floor(Math.random() * (GOLDEN_MAX_S - GOLDEN_MIN_S + 1));
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
        sound: true,
        vibration: true,
        count: 0,
        countText: '0',
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
        cookieSrc: COOKIE,
        plus: ''
    },
    onInit() {
        this.achieved = ACHIEVEMENTS.map(() => false);
        this.setOwned(this.owned);
        goldenIn = nextGolden();
        // "sound,vibration,language", e.g. "1,1,en". Settings are not part of the game,
        // so they load on their own and a reset keeps them.
        load('settings', '', (settings) => {
            const parts = settings.split(',');
            this.sound = parts[0] !== '0';
            this.vibration = parts[1] !== '0';
            this.setLanguage(LANGUAGES.indexOf(parts[2]) >= 0 ? parts[2] : 'en');
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
        this.vibrate('long');
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
        this.vibrate('long');
        this.golden = '';
        goldenIn = nextGolden();
        this.goldenClicks++;
        this.frenzyLeft = FRENZY_S;
        this.frenzyText = 'x' + FRENZY_MULT + '  ' + FRENZY_S + ' s';
        this.updateRates();
        this.checkAchievements();
    },
    vibrate(mode) {
        if (this.vibration) {
            vibrator.vibrate({ mode: mode });
        }
    },
    playClick() {
        if (!this.sound || !audio) {
            return;
        }
        try {
            audio.src = CLICK_SOUND;
            audio.play();
        } catch (e) {
            console.error('click sound: ' + e);
        }
    },
    multiplier() {
        return this.frenzyLeft > 0 ? FRENZY_MULT : 1;
    },
    increment() {
        this.taps++;
        this.bake(this.tapPower * this.multiplier());
        this.vibrate('short');
        this.playClick();

        this.cookieSrc = COOKIE_PRESSED;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
            this.cookieSrc = COOKIE;
        }, PRESS_MS);

        this.plus = this.plus === 'a' ? 'b' : 'a';

        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            this.save();
        }, SAVE_DELAY_MS);
    },
    // A sideways swipe opens the menu, or closes it if it is open.
    swipeCookie(e) {
        if (e.direction === 'left' || e.direction === 'right') {
            this.menu = !this.menu;
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
    // A sideways swipe in a category goes back to the grid. Switching views inside the swipe
    // event left the grid tiles ignoring taps in the Previewer, so it waits for the event to end.
    swipeCategory(e) {
        if (e.direction === 'left' || e.direction === 'right') {
            setTimeout(() => {
                this.openAchievements();
            }, 0);
        }
    },
    openSettings() {
        this.menu = false;
        this.view = 'settings';
        this.focusCrown('settingsList');
    },
    toggleSound() {
        this.sound = !this.sound;
        this.saveSettings();
    },
    toggleVibration() {
        this.vibration = !this.vibration;
        this.saveSettings();
        this.vibrate('short');
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
    },
    saveSettings() {
        storage.set({ key: 'settings', value: [this.sound ? 1 : 0, this.vibration ? 1 : 0, this.lang].join(',') });
    },
    openResetConfirm() {
        this.view = 'confirmReset';
    },
    cancelReset() {
        this.openSettings();
    },
    // A sideways swipe on the confirmation cancels, after the swipe event ends (see swipeCategory).
    swipeConfirm(e) {
        if (e.direction === 'left' || e.direction === 'right') {
            setTimeout(() => {
                this.cancelReset();
            }, 0);
        }
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
        this.vibrate('long');
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
    // A sideways swipe goes back to the cookie, after the swipe event ends (see swipeCategory).
    swipeBack(e) {
        if (e.direction === 'left' || e.direction === 'right') {
            setTimeout(() => {
                this.closeView();
            }, 0);
        }
    },
    closeView() {
        this.view = 'cookie';
    },
    buy(index) {
        const price = this.price(index);
        if (this.count < price) {
            this.vibrate('long');
            return;
        }
        this.vibrate('short');
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
        this.countText = format(count);
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
            this.vibrate('long');
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
