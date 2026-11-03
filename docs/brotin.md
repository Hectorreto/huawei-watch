# Brotín

An original virtual pet: a plant creature in a pot, with its own art and rules, not a port of an existing game. It is `apps/brotin/` (bundle `com.hectorreto.brotin`, name "Brotín" on the watch). The text is Spanish only.

## How it works

- **Rules:** `pages/index/pet.js` holds all of them, with no views or watch APIs, so they run in Node; `index.js` only draws and handles taps. Water, sun and mood fall with real time, also while the app is closed: `advance` works out the time since `last` on opening and every 30 s, in at most 200 steps since the watch's JS is slow. Bugs appear by day, about one per 3 hours, at most 3.
- **Night (22:00-7:00, local):** the pet sleeps. Needs fall at a quarter of the speed, sun does not fall and no bugs appear. Sun, play and stroking are refused.
- **Health:** a need at 0 or 3 bugs each wear it down (12 hours with one trouble); it recovers when all needs are above 40. At 0 the pet leaves a new seed and the generation goes up, so nothing is lost for good.
- **Growth:** seed, sprout at 30 min, young at 12 h, adult at 48 h. The adult depends on the average of needs and health over its life: flower from 70, cactus from 40, mushroom below.
- **Taps:** one full-screen `div` takes every tap and `hit` in `pet.js` says what it means, as in the maze. Bottom buttons: water, sun, play, clean. The bars at the top open the status view, and a tap on the pet strokes it.
- **Game:** 8 sparks appear inside the round screen for 1.1 s each; each one caught adds 6 mood.
- **Drawing:** no `for`, `if` or canvas, since making views closed the lab on the watch and froze the Previewer (`compare-drawing-methods.md`). All views exist from the start and switch with `show`. The body is one image whose bound `top` moves 6 px each second for the breathing, behind the pot's rim; the face is a separate image over it, so 6 forms and 6 faces need no image per combination. The sky colour is bound.
- **Art:** `tools/make_brotin_sprites.js` writes every PNG and the launcher icon from text grids in the script, scaled up with nearest neighbour because the watch blurs what it scales. With a second argument it writes a contact sheet to check the art without building.
- **Do not name a page method `render`:** the compiled page has its own, so calling it threw `Expected a function` and the page stayed on its initial data, with no error but a bare `JSI:CallFunction error returned!` in `previewer.log`. A temporary `try`/`catch` showing `e.message` in a text found it. The method is `refresh`.
- **Do not call `clearTimeout` on a timer from inside its own callback:** in the Previewer the game stopped after its first spark when `hideSpark`, called by that spark's timer, cleared it and then set the next one; taking the clear out of that path fixed it. Only a tap, which comes while the timer is pending, clears it now.
- **Saving:** `pet` in `@system.storage` as a comma-separated string, after each action, on growth, every 10 minutes and on closing. A lost write only costs the last actions, since the time is worked out again from the saved `last`.

## Testing in the Previewer

Raise `TIME_SCALE` in `pet.js` to see a whole life quickly (at 2880, an hour of game passes per 1.25 s) and put it back to 1 before building for the watch.

## Status

The rules were checked in Node (November 2026): saving, night, growth to each adult form, withering to a new seed, the clock going backwards, refusals and tap zones. The app compiles (`LegacyCompileLiteJS` and `LegacyGenerateLiteCode` pass). In the Previewer (November 2026): the main view and its layout, the seed's face in place, the water and clean buttons with their refusals, the status view, stroking, and the game starting, hiding the buttons and ending. Catching a spark, the sun button, night, bugs and the adult forms have not been seen there. There is no signed HAP yet: the build stops at `LegacySignLiteBin` until the debug profile `brotin.p7b` exists (`add-a-new-app.md`). What is left to check is in `watch-test-list.md`.
