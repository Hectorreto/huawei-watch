# Things to test on the watch

Changes built but not yet checked on the GT 6 Pro. Install them together in the next watch session; when one is checked, record the result in its own doc and remove it from here.

## Bakery clicker (`apps/bakery-clicker/`)

The Previewer has shown batch buying, golden cookies, the frenzy and the new batch reset working (November 2026).

- Cookie press (`pressCookie`): a tap shrinks the cookie for a moment and it stays centred. The press is too short to see in the Previewer.
- Quick taps all count: tap 20 times fast and the count goes up by 20 x tap power. This is what the earlier press effect broke.
- The game does not feel slower while tapping fast: the "+N" and the production counter keep moving.
- Buying in the shop does not freeze the app. In the Previewer it froze in 3 of 6 buys on one run and never in 10 on the next; cause unknown.
- New buildings, one-time upgrades, the daily streak, the golden cookie on return, the buy shortcut on the cookie and the cookie themes from awards look right and fit inside the round edge.

## Maze (`apps/maze/`)

The Previewer has shown the menu, help, controls, map, result screen, levels, dark levels, gems, being caught, the guardian and the key and door working (November 2026).

- Taps are not lost. In the Previewer some taps did nothing even after Reload; find out whether that happens on the watch too.
- One tap moves one full cell, and the per-level colours, stars and rank on the result screen draw correctly.
- Vibration on gems, guardian nearby, capture and exit.
- The maze in progress is restored after closing and reopening the app.
- The screen may turn off after two minutes without a tap, and the game resumes when it turns back on.
