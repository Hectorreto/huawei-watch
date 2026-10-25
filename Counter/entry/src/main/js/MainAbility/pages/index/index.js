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

let pressTimer = null;
let saveTimer = null;
let tickTimer = null;
let ticks = 0;

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
        plusText: '+1',
        items: [],
        cookieSrc: COOKIE,
        plus: ''
    },
    onInit() {
        storage.get({
            key: 'count',
            default: '0',
            success: (value) => {
                // Add instead of assign so taps made before the read finishes are kept.
                this.setCount(this.count + (parseInt(value, 10) || 0));
            }
        });
        storage.get({
            key: 'owned',
            default: '',
            success: (value) => {
                const parts = value.split(',');
                const owned = UPGRADES.map((u, i) => parseInt(parts[i], 10) || 0);
                this.setOwned(owned);
            }
        });
        this.setOwned(this.owned);
        tickTimer = setInterval(() => {
            this.tick();
        }, 1000);
    },
    onDestroy() {
        clearInterval(tickTimer);
        this.save();
    },
    tick() {
        if (this.cps > 0) {
            this.setCount(this.count + this.cps);
            ticks++;
            if (ticks % SAVE_EVERY_TICKS === 0) {
                this.save();
            }
        }
    },
    increment() {
        this.setCount(this.count + this.tapPower);
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
        this.plusText = '+' + format(tap);
        this.rateText = format(cps) + ' / s';
        this.refreshItems();
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
    }
};
