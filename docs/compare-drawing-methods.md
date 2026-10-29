# Compare ways of drawing on the watch

Goal: find out which way of drawing works on the GT 6 Pro and which is fastest: `canvas`, plain components (`div`s placed with a bound `style`), or other lite components. Background: a full-screen `canvas` with 3,480 `fillRect` rebooted the watch, and images written at runtime were slow (see "Canvas reboots the watch" and "Images built at runtime" in `create-and-preview-the-app.md`).

## The lab

The branch `lab-dibujo` turns the app into a list of tests ("Drawing lab"); its last row, "Back to the game", opens the game with `router.replace`. The lab is temporary and stays off `main`.

- **The lab has to be `pages/index/index`.** A first try added it as `pages/lab/lab`, first in `config.json` `pages`; the HAP contained it, but the watch still opened the game. The app starts at `pages/index/index` whatever the order, so on the branch the lab is `pages/index/` and the game moved to `pages/game/game.*`.
- Tap a row to run it. Tap anywhere to go back to the list. Each row shows its last result under its name.
- Before a test starts its id is saved as `labRunning` (on the `storage.set` success callback, so it is on flash first) and cleared when it finishes. If the watch reboots or freezes, the next launch shows that test as `CRASH / reboot`. Results are saved as `labResults` (`id=text|id=text`, no JSON), so they survive a reboot. The Previewer forgets storage when it reloads, so the marker can only be checked on the watch.
- `js N ms`: time spent in the drawing calls. `all N ms`: until a 0 ms `setTimeout` runs after them. `N ms/frame`: average over 60 frames (30 for `h5`) asked for every 16 ms (`FRAME_MS`), so 16 is full speed and more means drawing falls behind. A first version chained frames with 0 ms timeouts: the Previewer ran all 60 before drawing any and reported 0 ms/frame.
- Rows pass their index to `run`, since the Previewer ignores string arguments from `onclick`.
- `for` and `if` cannot be on the same element (build error at that line); the `div` grid is a `for` inside an `if` `stack`.
- Values the page keeps outside `data` (`results`, `timer`) are module variables, as in the game. As non-function properties of the page object they did not reach `this`, and the list stayed empty in the Previewer.

| Id | What | Compare with |
|---|---|---|
| c1, c2 | Canvas 100 px / 466 px with one `fillRect` | narrows down the reboot: canvas or its size |
| c3, c4, c5 | Full-screen canvas with 100 / 1,000 / 3,500 `fillRect` | h1, h3 |
| c6 | 200 px canvas, a square moving 60 frames | h4 |
| c7 | Canvas `arc`, lines, `stroke`, `fillText` | |
| h1, h2, h3 | 100 / 400 / 1,000 `div`s with bound position, size and colour | c3, c4 |
| h4 | One `div` moving 60 frames through a bound `left` | c6 |
| h5 | Rebuilding the 100 `div`s with new colours, 30 frames | |
| i1 | Swapping an `image` src 60 times | |
| i2 | `image-animator` with the 10 theme images | look whether frames change |
| i3 | `analog-clock` + `clock-hand` (rotates an image by the time) | look whether the hand turns |
| k1 | `@keyframes` `rotate` on an `image` in a positioned `stack` | look whether it turns in place |
| p1 | `progress type="arc"` animated, and a line `chart` | |
| q1 | `qrcode` | |

Lite Wearable components (from `lib/templater/lite_component_map.js`): `div`, `stack`, `list`/`list-item`, `swiper`, `tabs`, `text`, `marquee`, `image`, `image-animator`, `analog-clock`/`clock-hand`, `progress`, `chart`, `qrcode`, `input`, `slider`, `switch`, `picker-view` and `canvas`. No `svg`.

The build warns that `pivot-x`, `pivot-y` (`clock-hand`) and `total-width` (`progress`) are not standard; it still builds.

## Results

**The JS heap is 512 KB** (`heap total size: 524280` in `previewer.log` when it ran out). Everything in `data` counts: when 400 `div`s were bound, about 220 KB went to properties and 150 KB to objects, so each bound item costs roughly 1 KB. Plain JS arrays outside `data` are much cheaper (c5 builds 3,500 cell objects and is fine).

Previewer (October 2026):

| Id | Result |
|---|---|
| c1, c2 | Draws; js 0 / all 0 ms |
| c3 | js 1 / all 1 ms |
| c4 | js 3 / all 3 ms |
| c5 | js 12 / all 12 ms |
| c6 | 30 ms/frame |
| c7 | Circle, triangle and text all draw |
| h1 | 100 `div`s draw; all 8 ms |
| h2 | **JS heap out of memory** (`ERR_OUT_OF_MEMORY`, `JS HEAP OOM`); the Previewer engine crashed. h3 was not run, since it needs even more |
| h4 | 30 ms/frame |
| h5 | 69 ms/frame |
| i1 | 30 ms/frame |
| i2 | Works: the frames change by themselves |
| i3 | Draws nothing (no face, no hand) |
| k1 | Turns in place. With `left`/`top` on the animated `image` itself it turned, but in the top-left corner (the animation drops its own position); inside a positioned `stack` (`spinner-box`) at 0,0 it turns where it should |
| p1 | Arc and line chart draw; 29 ms/frame |
| q1 | Draws a QR code |

So images can be rotated with `@keyframes` (full turns or fixed angles, not to an angle chosen at runtime, since `transform` is only allowed inside `@keyframes`).

GT 6 Pro (October 2026), about 30-100 times slower than the Previewer:

| Id | Result |
|---|---|
| c1, c2 | js 1 / all 1 ms. A canvas, even full-screen, is fine |
| c3 | js 35 / all 54 ms |
| c4 | js 339 / all 487 ms |
| c5 | **Crash / reboot** |
| c6 | 33 ms/frame |
| c7 | js 2 / all 2 ms |
| h1 | all 544 ms |
| h2, h3 | Mostly turned the watch off (sometimes only closed the app) |
| h4 | 34 ms/frame |
| h5 | **Crash / reboot** |
| i1 | 51 ms/frame |
| p1 | 35 ms/frame |
| i2, i3, k1, q1 | Ran without crashing; what they showed is not recorded yet |

What this shows:

- **Canvas is about 10 times faster than `div`s** for the same 100 squares (54 ms against 544 ms), and uses no `data` memory per square.
- **Each `fillRect` costs about 0.34 ms** on the watch (100 → 35 ms, 1,000 → 339 ms), so a drawing of a few hundred rects is fine, 1,000 takes half a second, and 3,500 crashes the watch. The earlier concha reboot (3,480 rects) was the number of rects, not the canvas or its size. Where between 1,000 and 3,500 it breaks, and whether by count or by time, is not known.
- **`div`s are limited by the 512 KB JS heap**: 100 work (slowly), 400 and 1,000 crash. Rebuilding 100 `div`s 30 times (h5) also crashed, so replacing bound arrays repeatedly runs out of memory too.
- **Small animations run at about 33 ms/frame (30 fps)** with canvas, a `div` or the arc; swapping an image src is slower (51 ms).
- When the watch turns off, the `storage` writes of the last tests are lost (their rows show `-` again, and the crash marker may be lost too), so a test that reboots the watch is not always marked `CRASH / reboot`. Write down crashes by hand.

Previewer quirks while testing: the first tap after scrolling the list is often ignored, and a long fast drag does not scroll it (shorter drags do).
