# Things to test on the watch

Changes built but not yet checked on the GT 6 Pro. Install them together in the next watch session; when one is checked, record the result in its own doc and remove it from here.

## Bakery clicker (`apps/bakery-clicker/`)

Back to the October version, which counted quick taps and bought on the watch; the November improvements closed the app (`known-issues.md`). New since then: each theme is one 100 px image with the art at 1x (no `_small` images), shown at 100 px for the big cookie and the menu centre.

- The small cookie looks sharp and centred on the cookie view and in the menu, the theme list and settings row show it, and a tap anywhere on the screen still counts.
- The cookie shows at 120 px and shrinks to 100 px for a moment per tap; the plain white "+N" reads.
- Quick taps all count and buying does not close the app, as in October; the save from the November version (more entries in `owned`) loads.

## Órbita (`apps/orbit/`)

Installed in November 2026: it looks very good and the crown turns the arena continuously at a good speed. See `orbit-game.md`, **Status**.

- Diamonds score and vibrate, spikes end the game, and closing and reopening resumes the score, the ball and its speed.
- After a bounce the new spikes appear 3 a frame without a visible hitch, and they look right while turning.
- The ruby (from 20 s of play, 8 s on the screen) adds half the score, at least 1.
- The shield wheel (from 15 s, 9 s on the screen) turns the ball green, and the next spike hit only takes the shield.
- The ball speeds up a little with each diamond (225 to 380 px/s) and the speed feels right.

## Maze (`apps/maze/`)

The Previewer has shown the menu, help, controls, map, result screen, levels, dark levels, gems, being caught, the guardian and the key and door working (November 2026).

On the GT 6 Pro (November 2026) movement felt good and the result screen with stars and the daily challenge looked right; the menu and help problems are in `known-issues.md`.

- The menu: only the "Seguir", "Reto del día" and "Controles" buttons respond; "Controles" shows the help and a tap returns to the menu.
- On the map, the "Menú" button returns to the menu, and "Seguir" (or the challenge) carries on where the maze was left.
- Vibration on gems, guardian nearby, capture and exit.
- The maze in progress is restored after closing and reopening the app.
- The screen may turn off after two minutes without a tap, and the game resumes when it turns back on.

## Brotín (`apps/brotin/`)

It installs and opens on the watch (November 2026), and its main screen looks right. `brotin.md` says what the Previewer has already shown.

- The four buttons respond at their spots, and tapping the bars opens and closes the status view.
- `show` hides the buttons during the game and the status view covers everything.
- Bound `top` and face `src` every second: leave it open 10 minutes and check it does not close or slow down. The lab only swapped an `image` src 60 times.
- A tap on a spark catches it and the count goes up; quick taps are not lost.
- Bugs appear on screen and the clean button removes them; the sun button works.
- Each adult form (flower, cactus, mushroom) has its face in place; raise `TIME_SCALE` in the Previewer to get there.
- Close it, wait, reopen: the bars have fallen and the age has gone up. `Date.now()` and `getHours()` give the watch's real local time.
- At night (after 22:00) it sleeps, with the dark sky and refusals, and by morning it wakes.
- A save survives closing the app and turning the watch off.
- Accents and "¡" draw in the note and the status view.
- The launcher icon looks right.
