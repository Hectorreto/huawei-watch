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
    { name: 'Dedo de oro', base: 15, tap: 1, cps: 0 },
    { name: 'Cursor', base: 25, tap: 0, cps: 1 },
    { name: 'Abuela', base: 150, tap: 0, cps: 5 },
    { name: 'Granja', base: 1500, tap: 0, cps: 40 },
    { name: 'Mina', base: 15000, tap: 0, cps: 250 }
];
const PRICE_GROWTH = 1.15;
// Offline earnings stop after this long away, so an old save does not give a huge jump.
const OFFLINE_MAX_S = 24 * 60 * 60;
const AWAY_MESSAGE_MS = 4000;
// The golden cookie shows up every 45-120 s, stays 10 s, and a tap on it multiplies
// taps and production by 7 for 30 s.
const GOLDEN_MIN_S = 45;
const GOLDEN_MAX_S = 120;
const GOLDEN_STAY_S = 10;
const FRENZY_MULT = 7;
const FRENZY_S = 30;

let pressTimer = null;
let saveTimer = null;
let tickTimer = null;
let ticks = 0;
let goldenIn = 0;
let goldenLeft = 0;

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

export default {
    data: {
        view: 'cookie',
        count: 0,
        countText: '0',
        owned: [0, 0, 0, 0, 0],
        tapPower: 1,
        cps: 0,
        rateText: '0 / s',
        awayText: '',
        frenzyLeft: 0,
        frenzyText: '',
        golden: '',
        plusText: '+1',
        items: [],
        cookieSrc: COOKIE,
        plus: ''
    },
    onInit() {
        this.setOwned(this.owned);
        goldenIn = nextGolden();
        // Chained so the offline earnings use the loaded upgrades.
        storage.get({
            key: 'owned',
            default: '',
            success: (owned) => {
                const parts = owned.split(',');
                this.setOwned(UPGRADES.map((u, i) => parseInt(parts[i], 10) || 0));
                storage.get({
                    key: 'count',
                    default: '0',
                    success: (count) => {
                        // Add instead of assign so taps made before the read finishes are kept.
                        this.setCount(this.count + (parseInt(count, 10) || 0));
                        storage.get({
                            key: 'savedAt',
                            default: '0',
                            success: (savedAt) => {
                                this.addOfflineEarnings(parseInt(savedAt, 10) || 0);
                            }
                        });
                    }
                });
            }
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
        this.setCount(this.count + earned);
        this.save();
        vibrator.vibrate({ mode: 'long' });
        this.awayText = '+' + format(earned) + ' fuera';
        setTimeout(() => {
            this.awayText = '';
        }, AWAY_MESSAGE_MS);
    },
    tick() {
        if (this.cps > 0) {
            this.setCount(this.count + this.cps * this.multiplier());
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
        this.frenzyLeft = FRENZY_S;
        this.frenzyText = 'x' + FRENZY_MULT + '  ' + FRENZY_S + ' s';
        this.updateRates();
    },
    multiplier() {
        return this.frenzyLeft > 0 ? FRENZY_MULT : 1;
    },
    increment() {
        this.setCount(this.count + this.tapPower * this.multiplier());
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
    },
    closeShop() {
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
    setCount(count) {
        this.count = count;
        this.countText = format(count);
        if (this.view === 'shop') {
            this.refreshItems();
        }
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
    },
    updateRates() {
        this.plusText = '+' + format(this.tapPower * this.multiplier());
        this.rateText = format(this.cps * this.multiplier()) + ' / s';
    },
    // Rebuilt as a new array: lite does not reliably notice changes inside array items.
    refreshItems() {
        this.items = UPGRADES.map((u, i) => {
            const price = this.price(i);
            const gain = u.tap > 0 ? '+' + u.tap + ' toque' : '+' + u.cps + ' / s';
            return {
                title: u.name + ' (' + this.owned[i] + ')',
                detail: format(price) + '  ' + gain,
                affordable: this.count >= price
            };
        });
    },
    save() {
        clearTimeout(saveTimer);
        storage.set({ key: 'count', value: String(this.count) });
        storage.set({ key: 'owned', value: this.owned.join(',') });
        storage.set({ key: 'savedAt', value: String(Date.now()) });
    }
};
