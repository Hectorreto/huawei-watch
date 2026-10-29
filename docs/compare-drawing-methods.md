# Compare ways of drawing on the watch

Goal: find out which way of drawing works on the GT 6 Pro and which is fastest: `canvas`, plain components (`div`s placed with a bound `style`), or other lite components. Background: a full-screen `canvas` with 3,480 `fillRect` rebooted the watch, and images written at runtime were slow (see "Canvas reboots the watch" and "Images built at runtime" in `create-and-preview-the-app.md`).

## The lab

The branch `lab-dibujo` adds `pages/lab/lab` as the first page in `config.json`, so the app opens a list of tests ("Drawing lab"); its last row, "Back to the game", opens the game with `router.replace`. The lab is temporary and stays off `main`.

- Tap a row to run it. Tap anywhere to go back to the list. Each row shows its last result under its name.
- Before a test starts its id is saved as `labRunning` (on the `storage.set` success callback, so it is on flash first) and cleared when it finishes. If the watch reboots or freezes, the next launch shows that test as `CRASH / reboot`. Results are saved as `labResults` (`id=text|id=text`, no JSON), so they survive a reboot.
- `js N ms`: time spent in the drawing calls. `all N ms`: until a 0 ms `setTimeout` runs after them, which is roughly when the frame has been drawn (lite runs JS and rendering on one thread). `N ms/frame`: average of 60 frames (30 for `h5`), each started by a 0 ms timeout after the previous one.
- Rows pass their index to `run`, since the Previewer ignores string arguments from `onclick`.
- `for` and `if` cannot be on the same element (build error at that line); the `div` grid is a `for` inside an `if` `stack`.

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

Builds (October 2026). Not yet checked in the Previewer or on the watch.

Run the tests in order (c1 first): each canvas test can reboot the watch.
