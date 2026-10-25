# Create a Lite Wearable project and check it in the Previewer

## Setup on the Windows PC

- DevEco Studio **6.1.1** (build 243.24978.46.36.611280) at `E:\Programs\Huawei\DevEco Studio`. It was downloaded from https://developer.huawei.com/consumer/en/download/, which needs a Huawei ID login. winget's `Huawei.DevEco` only has 3.1.0.
- The bundled SDK is HarmonyOS 6.1.1(24) at `E:\Programs\Huawei\DevEco Studio\sdk\default`. It includes the Lite Wearable previewer (`openharmony/previewer/liteWearable`), so no extra SDK download was needed. DevEco also brings its own Node and ohpm under `tools/`.
- User data lives in `%LOCALAPPDATA%\Huawei\` and `%APPDATA%\Huawei\DevEcoStudio6.1`.

## Creating the project

File > New > Create Project > Application > **[Lite]Empty Ability** (the template with a watch icon). It is JS, FA model, `deviceType: liteWearable`. The template accepts compatible SDKs 4.0.0(10) to 6.1.1(24).

`Counter/` was created with:

| Field | Value |
|---|---|
| Project name | Counter |
| Bundle name | `com.hectorreto.counter` (the AppGallery Connect app must use the same package name) |
| Save location | `huawei-watch\Counter` |
| Compatible SDK | **5.0.0(12)**, the lowest common value that GT 6 projects use; the confirmed GT 6 project used 5.0.5(17), which this DevEco does not list |
| Target SDK | 6.1.1(24), set by the wizard in `build-profile.json5` |

The first sync shows "Project sync failed" while ohpm installs packages; it retries on its own and finishes in about 30 s. Ignore the banner if the Sync tab ends with exit code 0.

Driving the wizard with computer use: DevEco Studio is granted at **full** tier (typing works), because it is not recognised as an IDE.

## The app

`entry/src/main/js/MainAbility/pages/index/` is one page with three views, switched with `if` on `view`: the cookie, the shop and the achievements. Changing `view` is enough, so no `@system.router` page is needed and the production timer keeps running in the other views.

**Cookie view:** the count, the cookies per second, a "+N" row, the cookie (a `div` with `onclick="increment"`), and a row with the "Tienda" and "Logros" buttons (120 px each in a 250 px row, about as wide as the round screen allows at that height). Only the cookie counts taps, so the buttons do not add cookies. Each tap:

- adds `tapPower` (1 + one per "Dedo de oro");
- vibrates briefly with `@system.vibrator` (`mode: 'short'`), which needs `ohos.permission.VIBRATE` in `reqPermissions` in `config.json`, with `reason` and `usedScene` (with only `name`, the watch refuses to install it with error 46; see `install-on-the-watch.md`);
- swaps the cookie to `common/cookie_pressed.png` for 120 ms. The press is an image swap because lite `@keyframes` are not a reliable way to scale an image;
- shows a "+N" that rises and fades. Lite does not allow binding `class` to data (build error "class selector does not support data binding"), so the page toggles between two `if` texts, and each one starts its animation when it is created. Greying out unaffordable shop rows uses the same trick.

**Shop view:** a `list` of the `UPGRADES` in `index.js` (Dedo de oro +1 per tap, Cursor, Abuela, Granja, Mina +N per second). The price is `base * 1.15^owned`. Tapping a row buys it (short vibration) or, if there are not enough cookies, gives a long vibration. `onclick="buy($idx)"` inside a `for` compiles to a handler that gets the row index. `items` is rebuilt as a new array on every change, because lite does not reliably notice changes inside array items.

**Production and saving:** a 1 s `setInterval` adds the cookies per second. `@system.storage` holds `count`, `owned` (comma-separated counts in `UPGRADES` order, so new upgrades must be appended), `stats` (`baked,taps,golden`: cookies ever made, taps, golden cookies tapped) and `achieved` (one `0`/`1` per entry in `ACHIEVEMENTS` order, so append only). It saves 1 s after the last tap, every 10 s while producing, after each purchase and in `onDestroy`. `onInit` reads the keys in a chain and adds the stored values, so taps made before the reads finish are not lost. Nothing is saved until the whole chain has loaded, so a half-loaded state cannot overwrite the save. Large numbers show as 1.2K, 3.4M, and so on. Each save also stores `savedAt` (`Date.now()`).

**Offline earnings:** After the other keys are loaded (so the cookies per second are known), `onInit` reads `savedAt`, and adds cookies per second × seconds since `savedAt`, capped at 24 h. Because `savedAt` marks when `count` was saved, cookies produced after the last save are not counted twice. It then vibrates long and shows "+N fuera" in place of the rate. Messages there (offline earnings, achievements) are queued and show for 3 s each. Nothing is added if there is no `savedAt` yet, the clock went backwards, or nothing is produced. Confirmed on the GT 6 Pro (October 2026): reopening the app after a while adds cookies and shows the message, so `Date.now()` gives the real time there.

**Golden cookie:** the cookie view is a `stack` holding the column and two `if` images, `golden-left` and `golden-right`, with fixed `left`/`top`. Only one exists at a time; there is one per side because lite cannot bind `class` and position binding is not proven. Every 45-120 s spent on the cookie view, one appears beside the big cookie for 10 s. Tapping it gives a long vibration and a frenzy: taps and production ×7 for 30 s, with "x7  N s" in place of the rate. Offline earnings do not include the frenzy. The positions assume a 466 px screen and a column about 390 px tall. Confirmed on the GT 6 Pro (October 2026): it shows up in the right place, so `stack` with `left`/`top` works there, and the frenzy works.

**Achievements:** `ACHIEVEMENTS` in `index.js` lists 14 (cookies baked, taps, first of each upgrade, cookies per second, golden cookies), each with a `done(state)` check. They are checked whenever the count, the upgrades or the golden cookie count change, but only once the save is loaded, so saves made before achievements existed unlock everything they already qualify for at the next launch, without announcing old ones twice. A new one vibrates long and shows "Logro: <name>". For those older saves, `baked` starts at the current count. The "Logros" view shows "N / 14" and a list with unlocked entries in white and gold, locked ones in grey. Confirmed on the GT 6 Pro (October 2026): unlocking, the messages, the "Logros" view and the two-button row all work.

**Crown:** both lists have a `ref`, and opening their view calls `this.$refs.<ref>.rotation({ focus: true })` 50 ms later, because the `if` view has to render before its list exists. With the focus, turning the crown scrolls the list. `rotation()` on `list` is in the lite typings since API 4. `setMonitorForCrownEvents()` (raw crown events for the page) was not used because it only exists since API 24, above our compatible SDK. Not yet checked on the watch, including whether the focus survives the shop list being rebuilt every second.

`common/cookie.png` and `cookie_pressed.png` are 200x200 opaque RGB PNGs on black (cookie radius 96 and 84 px), and `golden.png` is 90x90 (radius 42). All are drawn with the same kind of pure-Python PNG script as the icon.

Confirmed on the GT 6 Pro (October 2026): the cookie press, the "+1" rising and fading (so lite keyframes do apply `translateY` and `opacity`), the vibration on each tap, and the count surviving closing and reopening the app. The shop (scrolling list, buying, greyed-out rows), the production timer and saving `owned` also work on the watch.

The name on the watch is `MainAbility_label` in `entry/src/main/resources/base/element/string.json` ("Cookie Clicker"); the template's default is "label". The launcher icon is `resources/base/media/icon.png` (104x104) and `icon_small.png` (92x92), RGBA PNGs; the template's default is a blue square with four white squares. Our cookie icon was drawn with a small pure-Python PNG script (Pillow is not installed on this PC).

## Previewer

Open `index.hml` and click **Previewer** on the right edge. It builds (`buildPreviewerResource`, a few seconds) and shows a round LiteWearable watch. Clicks on the screen act as taps.

- Clicks less than about a second apart counted once (three quick clicks → 1). Clicks two seconds apart each counted. Not yet checked whether a real watch behaves the same.
- The default text size (38px) looks small on the round screen. Lite Wearable only accepts some font sizes; try larger ones in the Previewer before changing it.
