import storage from '@system.storage';
import vibrator from '@system.vibrator';

const COOKIE = '/common/cookie.png';
const COOKIE_PRESSED = '/common/cookie_pressed.png';
const PRESS_MS = 120;
// Saving on every tap or tick would write flash constantly; save once taps pause,
// and every few seconds while cookies are produced on their own.
const SAVE_DELAY_MS = 1000;
const SAVE_EVERY_TICKS = 10;

// tap: cookies added per tap per owned; cps: cookies per second per owned.
// The order is the save format ("owned" is a comma-separated count per entry), so only append.
const UPGRADES = [
    { name: 'Golden finger', base: 15, tap: 1, cps: 0 },
    { name: 'Cursor', base: 25, tap: 0, cps: 1 },
    { name: 'Grandma', base: 150, tap: 0, cps: 5 },
    { name: 'Farm', base: 1500, tap: 0, cps: 40 },
    { name: 'Mine', base: 15000, tap: 0, cps: 250 }
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

// s is the game: baked (cookies ever made), taps, golden (golden cookies tapped), owned, cps.
// The order is the save format ("achieved" is one 0/1 per entry), so only append.
const ACHIEVEMENTS = [
    { name: 'First cookie', detail: 'Bake 1', done: (s) => s.baked >= 1 },
    { name: 'Baker', detail: 'Bake 100', done: (s) => s.baked >= 100 },
    { name: 'Bakery', detail: 'Bake 1K', done: (s) => s.baked >= 1e3 },
    { name: 'Factory', detail: 'Bake 100K', done: (s) => s.baked >= 1e5 },
    { name: 'Empire', detail: 'Bake 1M', done: (s) => s.baked >= 1e6 },
    { name: 'Fast finger', detail: '1K taps', done: (s) => s.taps >= 1e3 },
    { name: 'First cursor', detail: 'Buy a Cursor', done: (s) => s.owned[1] >= 1 },
    { name: 'Granny', detail: 'Buy a Grandma', done: (s) => s.owned[2] >= 1 },
    { name: 'Farmer', detail: 'Buy a Farm', done: (s) => s.owned[3] >= 1 },
    { name: 'Miner', detail: 'Buy a Mine', done: (s) => s.owned[4] >= 1 },
    { name: 'Rolling', detail: '10 / s', done: (s) => s.cps >= 10 },
    { name: 'Production', detail: '100 / s', done: (s) => s.cps >= 100 },
    { name: 'Lucky', detail: '1 golden cookie', done: (s) => s.golden >= 1 },
    { name: 'Gold digger', detail: '10 golden', done: (s) => s.golden >= 10 }
];

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
        count: 0,
        countText: '0',
        baked: 0,
        taps: 0,
        goldenClicks: 0,
        achieved: [],
        achievedText: '',
        achievementItems: [],
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
        cookieSrc: COOKIE,
        plus: ''
    },
    onInit() {
        this.achieved = ACHIEVEMENTS.map(() => false);
        this.setOwned(this.owned);
        goldenIn = nextGolden();
        // Chained so the offline earnings use the loaded upgrades, and achievements
        // are checked against the whole save.
        load('owned', '', (owned) => {
            this.setOwned(numbers(owned, UPGRADES.length));
            load('count', '0', (count) => {
                // Add instead of assign so taps made before the read finishes are kept.
                this.setCount(this.count + (parseInt(count, 10) || 0));
                load('stats', '', (stats) => {
                    const s = numbers(stats, 3);
                    // Saves from before "stats" existed: count is the best guess for baked.
                    this.baked = Math.max(this.baked + s[0], this.count);
                    this.taps += s[1];
                    this.goldenClicks += s[2];
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
        vibrator.vibrate({ mode: 'long' });
        this.showNotice('+' + format(earned) + ' away');
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
        if (this.cps > 0) {
            this.bake(this.cps * this.multiplier());
            ticks++;
            if (ticks % SAVE_EVERY_TICKS === 0) {
                this.save();
            }
        }
        this.tickGolden();
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
        // Only count down on the cookie view, so it never shows up unseen behind the shop.
        if (this.view !== 'cookie') {
            return;
        }
        goldenIn--;
        if (goldenIn <= 0) {
            this.golden = Math.random() < 0.5 ? 'left' : 'right';
            goldenLeft = GOLDEN_STAY_S;
        }
    },
    clickGolden() {
        vibrator.vibrate({ mode: 'long' });
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
        vibrator.vibrate({ mode: 'short' });

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
    openShop() {
        this.refreshItems();
        this.view = 'shop';
        this.focusCrown('shopList');
    },
    openAchievements() {
        this.refreshAchievements();
        this.view = 'achievements';
        this.focusCrown('achievementList');
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
            vibrator.vibrate({ mode: 'long' });
            return;
        }
        vibrator.vibrate({ mode: 'short' });
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
        if (this.view === 'shop') {
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
    checkAchievements() {
        if (!loaded) {
            return;
        }
        const state = { baked: this.baked, taps: this.taps, golden: this.goldenClicks, owned: this.owned, cps: this.cps };
        const achieved = this.achieved.slice();
        let changed = false;
        ACHIEVEMENTS.forEach((a, i) => {
            if (!achieved[i] && a.done(state)) {
                achieved[i] = true;
                changed = true;
                this.showNotice('Award: ' + a.name);
            }
        });
        if (changed) {
            this.achieved = achieved;
            vibrator.vibrate({ mode: 'long' });
            this.save();
        }
    },
    // Rebuilt as a new array: lite does not reliably notice changes inside array items.
    refreshItems() {
        this.items = UPGRADES.map((u, i) => {
            const price = this.price(i);
            const gain = u.tap > 0 ? '+' + u.tap + ' / tap' : '+' + u.cps + ' / s';
            return {
                title: u.name + ' (' + this.owned[i] + ')',
                detail: format(price) + '  ' + gain,
                affordable: this.count >= price
            };
        });
    },
    refreshAchievements() {
        let done = 0;
        this.achievementItems = ACHIEVEMENTS.map((a, i) => {
            if (this.achieved[i]) {
                done++;
            }
            return { title: a.name, detail: a.detail, done: this.achieved[i] };
        });
        this.achievedText = done + ' / ' + ACHIEVEMENTS.length;
    },
    save() {
        clearTimeout(saveTimer);
        // Saving half-loaded state would overwrite the stored achievements and stats.
        if (!loaded) {
            return;
        }
        storage.set({ key: 'count', value: String(this.count) });
        storage.set({ key: 'owned', value: this.owned.join(',') });
        storage.set({ key: 'stats', value: [this.baked, this.taps, this.goldenClicks].join(',') });
        storage.set({ key: 'achieved', value: this.achieved.map((a) => (a ? '1' : '0')).join('') });
        storage.set({ key: 'savedAt', value: String(Date.now()) });
    }
};
