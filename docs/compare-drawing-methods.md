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
| k1 | `@keyframes` `rotate` on an `image` | look whether it turns |
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
| k1 | The image jumps to the top-left corner (it loses its `left`/`top`) and does not visibly turn |
| p1 | Arc and line chart draw; 29 ms/frame |
| q1 | Draws a QR code |

So far in the Previewer: canvas is several times faster than `div`s for many squares (100 squares: 1 ms against 8 ms), and `div`s are limited by the JS heap to a few hundred. Simple animations (one moving square, an image swap, the arc) all ran at about 30 ms/frame, which seems to be the Previewer's timer floor. The Previewer runs on a PC, so only the watch tells the real costs.

Not yet run on the watch. Run the tests in order (c1 first): each canvas test can reboot the watch, and h2 and h3 will probably run out of memory.

Previewer quirks while testing: the first tap after scrolling the list is often ignored, and a long fast drag does not scroll it (shorter drags do).
