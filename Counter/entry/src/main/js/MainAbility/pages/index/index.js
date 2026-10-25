import storage from '@system.storage';
import vibrator from '@system.vibrator';

const COOKIE = '/common/cookie.png';
const COOKIE_PRESSED = '/common/cookie_pressed.png';
const PRESS_MS = 120;
// Saving on every tap would write flash constantly; save once taps pause.
const SAVE_DELAY_MS = 1000;

let pressTimer = null;
let saveTimer = null;

export default {
    data: {
        count: 0,
        cookieSrc: COOKIE,
        plus: ''
    },
    onInit() {
        storage.get({
            key: 'count',
            default: '0',
            success: (value) => {
                // Add instead of assign so taps made before the read finishes are kept.
                this.count += parseInt(value, 10) || 0;
            }
        });
    },
    onDestroy() {
        this.save();
    },
    increment() {
        this.count++;
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
    save() {
        clearTimeout(saveTimer);
        storage.set({ key: 'count', value: String(this.count) });
    }
};
