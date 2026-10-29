# Compare ways of drawing on the watch

Goal: find out which way of drawing works on the GT 6 Pro and which is fastest: `canvas`, plain components (`div`s placed with a bound `style`), or other lite components.

**Warning: do not run tests that reboot the watch over and over.** After several reboots in a row (October 2026) the GT 6 Pro showed a message that it would reset to factory settings in a few seconds; the watch then had to be paired with the Android phone again and the app reinstalled. The tests had been run one right after another, reopening the app as soon as the watch was back on, so the likely trigger is several reboots in a short time (many devices take that as a boot failure and offer a reset); not confirmed. The tests that rebooted it are out of the lab (see **Removed tests**). Run a new crash test once, not again to get a screenshot, and after a reboot wait a few minutes before the next one.

## Conclusions

- **Canvas is the fastest way to draw shapes**, about 10 times faster than `div`s (100 squares: 54 ms against 544 ms on the watch), but **only up to about 1,000 `fillRect` per canvas**. Each `fillRect` costs about 0.34 ms. 1,000 in one go worked (half a second); 1,500, 2,000, 2,500 and 3,500 rebooted the watch. Drawing in parts of 250 with a 0 ms timeout between them does not help: 3,500 in parts rebooted it before a quarter (under ~875 rects), the 4-colour concha in parts at about half (~980 of 1,962), the 8-colour one before half (under ~1,360 of 2,724). So the limit is the number of rects drawn on one canvas, not how long JS blocks; the canvas seems to keep every draw call (the Previewer keeps what each part drew). Lite `canvas` likely stores the calls and replays them, so memory grows with each one.
- So **pixel art stays as pre-scaled PNG images**: the 94x94 concha needs 1,962 rects even with 4 colours. The earlier full-screen concha reboot (3,480 rects) was this limit.
- **Not known yet:** whether an animation that keeps drawing on the same canvas (2 rects per frame) reboots the watch after ~500 frames, and whether recreating the canvas (`if` off and on) starts the count again. Find out before using canvas for anything that redraws for long.
- **`div`s are limited by the 512 KB JS heap**: each item bound in `data` costs about 1 KB. 100 work (slowly); 400 and 1,000 turned the watch off; rebuilding 100 `div`s 30 times also rebooted it.
- **Small animations run at about 33 ms/frame (30 fps)** with a canvas, a `div` or the `progress` arc; swapping an `image` src is slower (51 ms/frame).
- **`image-animator`** plays a list of images by itself. **`@keyframes` `rotate`** turns an image in place, if the image sits at 0,0 inside a positioned `stack` (on the image itself, the animation drops its `left`/`top` and it turns in the top-left corner); only fixed angles or full turns, since `transform` is only allowed inside `@keyframes`. **`progress type="arc"`**, **`chart`** and **`qrcode`** work. **`analog-clock`** draws nothing, in the Previewer or on the watch.

Lite Wearable components (from `lib/templater/lite_component_map.js`): `div`, `stack`, `list`/`list-item`, `swiper`, `tabs`, `text`, `marquee`, `image`, `image-animator`, `analog-clock`/`clock-hand`, `progress`, `chart`, `qrcode`, `input`, `slider`, `switch`, `picker-view` and `canvas`. No `svg`.

## The lab

The branch `lab-dibujo` turns the app into a list of tests ("Drawing lab"); its last row, "Back to the game", opens the game with `router.replace`. The lab is temporary and stays off `main`.

- **The lab has to be `pages/index/index`.** A first try added it as `pages/lab/lab`, first in `config.json` `pages`; the HAP contained it, but the watch still opened the game. The app starts at `pages/index/index` whatever the order, so on the branch the lab is `pages/index/` and the game moved to `pages/game/game.*`.
- Tap a row to run it. Tap anywhere to go back to the list. Each row shows its last result under its name.
- Before a test starts its id is saved as `labRunning` (on the `storage.set` success callback) and cleared when it finishes; the next launch shows a test that did not finish as `CRASH / reboot`. Results are saved as `labResults` (`id=text|id=text`, no JSON). But when the watch turns off, the last `storage` writes are often lost (rows show `-` again and the marker can be gone), so write down crashes by hand. The Previewer forgets storage when it reloads.
- `js N ms`: time spent in the drawing calls. `all N ms`: until a 0 ms `setTimeout` runs after them. `N ms/frame`: average over 60 frames asked for every 16 ms (`FRAME_MS`), so 16 is full speed and more means drawing falls behind. A first version chained frames with 0 ms timeouts: the Previewer ran all 60 before drawing any and reported 0 ms/frame.
- Rows pass their index to `run`, since the Previewer ignores string arguments from `onclick`.
- `for` and `if` cannot be on the same element (build error at that line); the `div` grid is a `for` inside an `if` `stack`.
- Values the page keeps outside `data` (`results`, `timer`) are module variables, as in the game. As non-function properties of the page object they did not reach `this`, and the list stayed empty in the Previewer.
- The build warns that `pivot-x`, `pivot-y` (`clock-hand`) and `total-width` (`progress`) are not standard; it still builds.
- Previewer quirks: the first tap after scrolling the list is often ignored, and a long fast drag does not scroll it (shorter drags do).

Results (October 2026; the watch is about 30-100 times slower than the Previewer):

| Id | What | Previewer | GT 6 Pro |
|---|---|---|---|
| c1, c2 | Canvas 100 px / 466 px with one `fillRect` | js 0 / all 0 ms | js 1 / all 1 ms |
| c3 | Full-screen canvas, 100 `fillRect` | js 1 / all 1 ms | js 35 / all 54 ms |
| c4 | Full-screen canvas, 1,000 `fillRect` | js 3 / all 3 ms | js 339 / all 487 ms |
| c6 | 200 px canvas, a square moving 60 frames | 30 ms/frame | 33 ms/frame |
| c7 | Canvas `arc`, lines, `stroke`, `fillText` | all draw | js 2 / all 2 ms |
| e1 | Count rects: one 10 px square every 16 ms inside the round screen (colour changes every 100), the count shown at the bottom, until 5,000 or a crash; read the exact limit off the screen | runs | not run yet |
| e2 | Like e1, but every 500 squares the canvas is removed (`if`) and a new one made: does that reset the limit? | at 500 a new, empty canvas appears and the count goes on | not run yet |
| h1 | 100 `div`s with bound position, size and colour | all 8 ms | all 544 ms |
| h4 | One `div` moving 60 frames through a bound `left` | 30 ms/frame | 34 ms/frame |
| i1 | Swapping an `image` src 60 times | 30 ms/frame | 51 ms/frame |
| i2 | `image-animator` with the 10 theme images | works | works |
| i3 | `analog-clock` + `clock-hand` | draws nothing | draws nothing |
| k1 | `@keyframes` `rotate` on an `image` in a positioned `stack` | turns in place | turns in place |
| p1 | `progress type="arc"` animated, and a line `chart` | 29 ms/frame | 35 ms/frame |
| q1 | `qrcode` | draws | draws |

## Removed tests

They rebooted the watch, so they are no longer in the lab (they are in the branch's history).

| Test | Previewer | GT 6 Pro |
|---|---|---|
| Canvas 1,500 / 2,000 / 2,500 / 3,500 `fillRect` in one go | 3,500: 12 ms | reboot |
| 3,500 `fillRect` in parts of 250 | 13 ms, draws all | reboot before a quarter |
| Concha, 4 colours, 1,962 rects, in one go / in parts | 30 ms | reboot / at about half |
| Concha, 8 colours, 2,724 rects, in parts | 57 ms | reboot before half |
| 400 / 1,000 `div`s | 400: JS heap out of memory (`ERR_OUT_OF_MEMORY`, `heap total size: 524280` in `previewer.log`; about 220 KB of properties and 150 KB of objects) | mostly turned the watch off, sometimes only closed the app |
| Rebuilding 100 `div`s with new colours, 30 times | 69 ms/frame | reboot |

**Cookie as rects:** `tools/make_concha_rects.js` (run with DevEco's `tools/node/node.exe`, no packages) reads a 466 px theme PNG, finds its art grid (94x94 for the concha) by trying which nearest-neighbour upscale matches best, reduces the colours with median cut and writes a module `{ size, colours, count, rects }`, where `rects` is a string of five characters per rect (x, y, width, height, colour index, each `String.fromCharCode(48 + value)`), so the page decodes it without building objects. Usage: `node tools/make_concha_rects.js <png> <out.js> <colours> <pixels|runs|rects|layered>`. The concha has 6,739 opaque pixels and the JPEG noise leaves short runs, so merging barely helps: 16 colours, 3,938 runs or 3,478 merged rectangles; 8 colours, 2,724 rectangles; 4 colours, 1,962 with `layered` (each row first drawn as one run of the main colour, the other colours over it). In the Previewer both concha versions looked right (8 colours keeps the orange crust, 4 makes it dark brown). All are over the ~1,000-rect limit.
