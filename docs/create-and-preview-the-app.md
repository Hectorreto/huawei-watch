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

**Cookie view:** a `stack` laid out with `left`/`top`. At the bottom is the cookie, a full-screen 466 px `div` with `onclick="increment"` and `onswipe="swipeCookie"`. Over it are a black capsule (300x96 px, `border-radius`) holding the count and the cookies per second, and a small "+N" row below the capsule. The overlays are kept small because taps on them do not reach the cookie. There are no buttons on the big cookie; a sideways swipe opens the menu (below). In the Previewer a swipe does not also count as a tap. Each tap:

- adds `tapPower` (1 + one per "Golden finger");
- vibrates briefly with `@system.vibrator` (`mode: 'short'`), which needs `ohos.permission.VIBRATE` in `reqPermissions` in `config.json`, with `reason` and `usedScene` (with only `name`, the watch refuses to install it with error 46; see `install-on-the-watch.md`);
- swaps the cookie to `common/cookie_pressed.png` for 120 ms. The press is an image swap because lite `@keyframes` are not a reliable way to scale an image;
- shows a "+N" in a small black pill that rises and fades (plain white text was hard to read on the cookie). Lite does not allow binding `class` to data (build error "class selector does not support data binding"), so the page toggles between two `if` texts, and each one starts its animation when it is created. Greying out unaffordable shop rows uses the same trick.

**Menu:** swiping left or right on the cookie view sets `menu`, which swaps the big cookie, the capsule, the "+N" and the golden cookie for a radial menu, as in the first watch of the concept art `WhatsApp Image 2026-10-25 at 1.57.09 PM.jpeg`: `common/cookie_small.png` (170 px) in the centre and six 100 px round buttons on a 155 px circle around it, clockwise from the top: shop (cart), stats, settings, close (X), awards (trophy), events (star). Each is an `if` image with fixed `left`/`top` in the `stack`, over a full-screen `menu-bg` div that only catches swipes. The cart opens the shop, the trophy the awards, and the X closes the menu; stats, settings and events do nothing yet. Another sideways swipe, or a tap on the small cookie, closes the menu without counting a cookie. Opening the shop or the awards closes the menu, so Back returns to the big cookie. The golden cookie does not count down while the menu is open. The buttons are cut from the concept icon sheet (`3b371dd9-…png`, "Navegación principal" row, circles of radius 49 px at y=113) with a PowerShell `System.Drawing` script that scales each to 100 px bicubic and clips it to a circle, so the corners are transparent; the small cookie is cut the same way from the pixel-art cookie. Confirmed on the GT 6 Pro (October 2026): the swipes open and close the menu, the small cookie closes it, the cart opens the shop and the trophy the awards.

**Shop view:** styled after the second watch of the concept art `WhatsApp Image 2026-10-25 at 12.18.38 PM.jpeg`: the count, the cookies per second and a gold "Shop" title at the top, then a `list` (340x260 px, ending about 50 px above the bottom so the last card is not cut by the round edge) of the `UPGRADES` in `index.js` (Golden finger +1 per tap, Cursor, Grandma, Farm, Mine +N per second). Each row is a dark card (`background-color` and `border-radius` on the `list-item`) with a 64 px icon, the name (24 px font), the gain and number owned (20 px), and a price pill with a small cookie: gold when affordable, grey when not (two `if` divs, as lite cannot bind `class`). There is no Back button: a sideways swipe on the view (`onswipe="swipeBack"`) returns to the cookie, and it works over the list too. The icons in `common/shop/` are 64 px squares cut from the concept icon sheet (`3b371dd9-…png`, "Íconos de edificios" row at y=330, and "+ Clics" for Golden finger), with the sheet's near-black background (about RGB 14,13,10) turned transparent by a PowerShell script that ramps alpha from 0 to 255 over a colour distance of 14 to 40. `coin.png` is the pixel-art cookie at 24 px. Confirmed on the GT 6 Pro (October 2026): the icons, cards, 24 and 20 px fonts, gold pills when affordable, crown scrolling and the swipe back all work. The price is `base * 1.15^owned`. Tapping a row buys it (short vibration) or, if there are not enough cookies, gives a long vibration. `onclick="buy($idx)"` inside a `for` compiles to a handler that gets the row index. `items` is rebuilt as a new array on every change, because lite does not reliably notice changes inside array items.

**Production and saving:** a 1 s `setInterval` adds the cookies per second. `@system.storage` holds `count`, `owned` (comma-separated counts in `UPGRADES` order, so new upgrades must be appended), `stats` (`baked,taps,golden`: cookies ever made, taps, golden cookies tapped) and `achieved` (one `0`/`1` per entry in `ACHIEVEMENTS` order, so append only). It saves 1 s after the last tap, every 10 s while producing, after each purchase and in `onDestroy`. `onInit` reads the keys in a chain and adds the stored values, so taps made before the reads finish are not lost. Nothing is saved until the whole chain has loaded, so a half-loaded state cannot overwrite the save. Large numbers show as 1.2K, 3.4M, and so on. Each save also stores `savedAt` (`Date.now()`).

**Offline earnings:** After the other keys are loaded (so the cookies per second are known), `onInit` reads `savedAt`, and adds cookies per second × seconds since `savedAt`, capped at 24 h. Because `savedAt` marks when `count` was saved, cookies produced after the last save are not counted twice. It then vibrates long and shows "+N away" in place of the rate. Messages there (offline earnings, achievements) are queued and show for 3 s each. Nothing is added if there is no `savedAt` yet, the clock went backwards, or nothing is produced. Confirmed on the GT 6 Pro (October 2026): reopening the app after a while adds cookies and shows the message, so `Date.now()` gives the real time there.

**Golden cookie:** the cookie view's `stack` also holds two `if` images, `golden-left` and `golden-right`, with fixed `left`/`top`. Only one exists at a time; there is one per side because lite cannot bind `class` and position binding is not proven. Every 45-120 s spent on the cookie view, one appears for 10 s over the left or right edge of the big cookie, level with the screen centre. Tapping it gives a long vibration and a frenzy: taps and production ×7 for 30 s, with "x7  N s" in place of the rate. Offline earnings do not include the frenzy. The positions assume a 466 px screen. Confirmed on the GT 6 Pro (October 2026), with the earlier 200 px cookie: it shows up in the right place, so `stack` with `left`/`top` works there, and the frenzy works. Confirmed on the GT 6 Pro (October 2026): the full-screen cookie, the capsule, the "+N" pill, the swipes and the golden cookie over the big one all work.

**Achievements:** `ACHIEVEMENTS` in `index.js` lists 14 (cookies baked, taps, first of each upgrade, cookies per second, golden cookies), each with a `value(state)`, a `goal` (done when the value reaches it), a category and an icon. They are checked whenever the count, the upgrades or the golden cookie count change, but only once the save is loaded, so saves made before achievements existed unlock everything they already qualify for at the next launch, without announcing old ones twice. A new one vibrates long and shows "Award: <name>". For those older saves, `baked` starts at the current count. Confirmed on the GT 6 Pro (October 2026): unlocking and the messages work.

**Awards views** (styled after the second and third watches of `WhatsApp Image 2026-10-25 at 1.57.09 PM.jpeg`, without their back buttons or page dots):

- The grid (`view: 'achievements'`) shows "Awards", "N / 14" and one tile per entry in `CATEGORIES` (Clicks, Cookies, Buildings, Speed, Golden) with icon, name and "done / total". It is a `list` of rows of three tiles, so it scrolls if categories are added. The rows use a nested `for`: `for="{{ (ri, row) in awardRows }}"` on the `list-item` and `for="{{ (ci, cat) in row.cats }}"` on the tile `div`, with `onclick="openCategory(cat.id)"`; naming the loop variables this way works in lite. Category names must fit a 104 px tile at 20 px ("Production" did not, hence "Speed").
- Tapping a tile opens that category (`view: 'category'`): its name, "done / total", and a list of cards with the achievement's icon, name, detail, a check (done) or a lock (not done), and, while a goal above 1 is not reached, a `<progress type="horizontal">` bar (gold `color`, `stroke-width: 8px`, brown `background-color`) with "value / goal".
- A sideways swipe in a category goes back to the grid, and in the grid back to the cookie. Switching from the category to the grid inside the swipe handler left the grid tiles ignoring taps in the Previewer (from the menu they worked), so `swipeCategory` switches in a `setTimeout(…, 0)`.
- The icons in `common/awards/` are 56 px squares cut from the concept icon sheet with the near-black background made transparent, like the shop icons; the buildings reuse `common/shop/`. `check.png` (36 px) is the gold "Comprado" circle, cut round; `lock.png` (36 px) is the "Bloqueado" lock with its grey tile (about RGB 26,26,25) made transparent.

Checked in the Previewer; not yet on the watch.

**Crown:** every list (shop, awards grid, category) has a `ref`, and opening their view calls `this.$refs.<ref>.rotation({ focus: true })` 50 ms later, because the `if` view has to render before its list exists. With the focus, turning the crown scrolls the list. `rotation()` on `list` is in the lite typings since API 4. `setMonitorForCrownEvents()` (raw crown events for the page) was not used because it only exists since API 24, above our compatible SDK. Confirmed on the GT 6 Pro (October 2026): the crown scrolls both lists, and the shop keeps the focus although its items are rebuilt every second.

**Gestures and buttons on the watch** (checked on the GT 6 Pro, October 2026): swiping in any direction does nothing unless the app handles `swipe`. The system adds no swipe-back gesture to this app, so all four swipes are free to use. Confirmed on the GT 6 Pro (October 2026): `onswipe` on a `div` in the cookie view works (it was used to open the shop and the awards before the menu existed). Pressing the crown exits the app (system). The lower button does nothing in the app: it does not run its configured shortcut, and an `onkey` handler on the root `div` and the `stack` got no event and no vibration, so the app cannot use it. Double-pressing it still opens Wallet (a system shortcut), even inside the app.

All on-screen text is in English. Renaming an upgrade or achievement is safe, because saves store them by position, not by name.

`common/cookie.png` and `cookie_pressed.png` are 466x466 opaque RGB PNGs on black, made from the ChatGPT pixel-art cookie (1254x1254 RGBA): the normal one fills the canvas, the pressed one is the same cookie at 438 px, centred. They were scaled with .NET `System.Drawing` from PowerShell (nearest neighbour, `PixelOffsetMode.Half`), because Pillow is not installed; bicubic looked almost the same. Each PNG is about 400 KB, and the build stores images uncompressed, so the HAP is about 2.6 MB. The watch handles both 466 px images fine (GT 6 Pro, October 2026). `golden.png` is a 90x90 RGBA PNG with a transparent background: the same pixel-art cookie, scaled bicubic and tinted gold with a `ColorMatrix` (luminance × 2.0 / 1.4 / 0.4 for R / G / B). An opaque PNG showed as a black square over the big cookie, so the round shape comes from the alpha channel (`border-radius` on the image was not tried). Confirmed on the GT 6 Pro (October 2026): the `image` component honours PNG transparency, so the golden cookie shows round.

Confirmed on the GT 6 Pro (October 2026): the cookie press, the "+1" rising and fading (so lite keyframes do apply `translateY` and `opacity`), the vibration on each tap, and the count surviving closing and reopening the app. The shop (scrolling list, buying, greyed-out rows), the production timer and saving `owned` also work on the watch.

The name on the watch is `MainAbility_label` in `entry/src/main/resources/base/element/string.json` ("Cookie Clicker"); the template's default is "label". The launcher icon is `resources/base/media/icon.png` (104x104) and `icon_small.png` (92x92), RGBA PNGs; the template's default is a blue square with four white squares. Our cookie icon was drawn with a small pure-Python PNG script (Pillow is not installed on this PC).

## Previewer

Open `index.hml` and click **Previewer** on the right edge. It builds (`buildPreviewerResource`, a few seconds) and shows a round LiteWearable watch. Clicks on the screen act as taps.

- Clicks less than about a second apart counted once (three quick clicks → 1). Clicks two seconds apart each counted. Not yet checked whether a real watch behaves the same.
- The default text size (38px) looks small on the round screen. Lite Wearable only accepts some font sizes; try larger ones in the Previewer before changing it.
