# Órbita (circular arena game)

`apps/orbit/` (bundle `com.hectorreto.orbita`, "Órbita" on the watch): a ball crosses a round arena the size of the screen; holding a half of the screen turns the arena, and with it the spikes and the diamond, but not the ball. Diamonds score, spikes end the game. An original game with the mechanic of the mobile game "360 Degree" (seen on its store pages in November 2026); none of its name, art or text is used.

## How it plays

- **Start:** the game opens paused, with the ball still in the centre; the first touch starts it. There is no pause button. After a loss the ball turns red where it hit, the line shows the record, and touches are ignored for 0.7 s (`OVER_PAUSE_MS`), since the player is usually still holding; the next touch starts a new game from 0.
- **Controls:** a full-screen `div` on top takes `touchstart`, `touchmove` and `touchend`; while a touch is down the arena turns at `TURN_SPEED` (2.8 rad/s), anticlockwise on the left half (x < 233), clockwise on the right. The touch events carry `globalX` on the event itself (see `create-and-preview-the-app.md`, **Gestures**).
- **Ball:** moves at 150 px/s plus 2 per point, up to 260, its heading turning slowly (`curve`, 0.1-0.3 rad/s to a random side) so it bends a little. On the wall (inner edge 224 px from the centre) it goes back the way it came, 5-20 degrees off to a random side, kept within about 60 degrees of straight in, with a new curve.
- **Spikes:** always 10, hidden until the first bounce. Each bounce first checks the spikes where it hit (that is the loss), then moves them all: two groups (4+6, 5+5 or 6+4) about a quarter turn to each side of the hit, or, from 3 points on and half of the time, three groups (3+3+4 in some order) at about 72 degrees to each side and one opposite. The nearest spike is always more than about 50 degrees from the hit, so a respawn never kills. A spike touches the ball within 18 px of its centre; this is checked every 6 px of travel, also while the arena turns, so turning a spike into the ball loses too.
- **Diamond:** one at a time, at a random spot 40-170 px from the centre and at least 90 px from the ball; it turns with the arena. Touching it scores 1, vibrates briefly and places a new one.
- **Score:** a large dim number in the centre, under everything that moves; the record shows under it while paused.

## Drawing

No canvas: a moving scene would need a full redraw every frame, a lite canvas takes only about 1,100 `fillRect` and has no `clearRect` (`compare-drawing-methods.md`). Everything is a fixed component moved with a bound `style`, as in the maze's gems:

- The arena is one `div` with a 9 px border and `border-radius` 233.
- The ball is a 20 px round `div` with bound `left`, `top` and `background-color`.
- The diamond is an `image` of `common/diamond.png` (30 px).
- The 10 spikes are 10 fixed `image`s (no `for`, which closed the lab when its array was swapped), each with bound `src`, `left` and `top`. Lite cannot rotate an image, so `common/spike_00.png` ... `spike_23.png` hold one 32 px spike per 15 degrees (`SPIKE_DIRS`), pointing inwards, and each spike shows the one nearest its angle; its `src` changes only when that changes. Hidden spikes sit at -100 px.
- The sprites are made by `tools/make_orbit_sprites.js` (DevEco's Node, no packages); the launcher icon by `tools/make_app_icons.py`.

A frame (`setInterval`, 33 ms) moves the ball by the real time since the last one (at most 0.1 s, so a slow frame slows the game rather than jumping) and assigns only bindings whose value changed: the ball's two coordinates every frame, the diamond and spikes only while the arena turns, about 22 values a frame then. On the drawing lab's numbers (one moving `div` 34 ms/frame; 100 bound `div`s 544 ms) that is expected to stay near 30 fps on the watch, but it is not measured yet.

## Saving

`@system.storage` key `orbita` holds one comma-separated string: score, record, ball position, heading and curve, the arena's turn, whether the spikes show, the diamond and the 10 spike angles, and a format version (21 numbers). It is written on each point, on each loss (already reset to a new game from 0, so a close right after losing starts fresh) and in `onDestroy`. On opening, the game is restored paused and the first touch carries on with the same score, ball and spikes. A save of another length is ignored. The screen is kept on (`brightness.setKeepScreenOn`) only while playing; paused, the system's timeout applies, which closes the app (see `compare-drawing-methods.md`, **Keep the screen on**), and the save restores it.

## Status

November 2026: checked in Node (the page's own code with stubbed storage, timers and clock; 200 games with random holds: the ball stays inside, the score and record grow, the save restores) and it compiles with hvigor. Without `orbita.p7b` the build stops at `LegacySignLiteBin`, as `add-a-new-app.md` says. Not yet seen in the Previewer or on the watch. To check there: that holding a half turns the arena smoothly and releasing stops it, the frame rate while turning (22 bindings a frame), that the spike images change direction cleanly, the 90 px score font, and that closing and reopening resumes.
