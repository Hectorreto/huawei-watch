# Things to test on the watch

Changes built but not yet checked on the GT 6 Pro. Install them together in the next watch session; when one is checked, record the result in its own doc and remove it from here.

## Brotín (`apps/brotin/`, branch `brotin`)

The signed HAP builds with its own profile (November 2026); install it with DevEco Assistant. `brotin.md` says what the Previewer has already shown.

- The screen matches the design: bars, note, pet in its pot, four buttons within the round edge.
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
