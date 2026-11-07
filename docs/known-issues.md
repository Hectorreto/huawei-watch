# Known issues and unfinished work

Things that are known to be wrong or unfinished, so they are not mistaken for new regressions. Fix one → remove it here and update the doc it points to.

## Bakery clicker: closes on quick taps and on buying (GT 6 Pro, November 2026)

With the November improvements merged (`b619534`), the watch:

- Quick taps: the count showed 1, 2, 3, then 16, stopped responding and the app closed. After reopening it the count was 3 (the later taps were never saved), and taps took about 3 s to show in the count.
- Buying a farm from the shop (edge swipe, cart) closed the app, twice in a row; after reopening it owned 1 farm, so the second buy was lost before its delayed save.
- The press effect itself looked fine.
- Leaving the shop, its title switches to "Upgrades" for about a second before the cookie comes back (shop and upgrades share one view since `0a8df7b`, and the title is `view === 'shop' ? ... : ...`).

The October version (`a8a1603`, no press effect, separate shop and upgrades views) bought and counted quick taps on the watch. The cause is not known yet. The likely suspects:

- The press effect resizes the full-screen 466 px cookie image to 438 px and back. The watch scales images itself, which may build a new scaled bitmap each time; full-screen native buffers (about 870 KB each) already crashed the drawing lab (`compare-drawing-methods.md`, s1 and s3).
- The 512 KB JS heap: `index.js` grew from 777 to 1,115 lines, with bigger `UPGRADES`, `ACHIEVEMENTS` and `THEMES` tables, and a buy rebuilds `items`, checks achievements and may save.

The Previewer did not log an error, although it froze in 3 of 6 buys once. The clicker was put back to the October version (`2c8609c`); the November improvements stay on branch `claude/mejoras-clicker-6e8b06`. Bring back only the ones worth it, one at a time, checking each on the watch, and keep the press effect out unless it is shown not to be the cause.

## Maze: menu and help (GT 6 Pro, November 2026)

- On the menu, a tap anywhere starts a maze: the top half continues the levels and the bottom half the daily challenge (`MENU_SPLIT`). "Seguir" and "Reto del día" do not look like buttons, and a tap outside both still starts a game.
- The controls help shows only in the first maze while no star has been earned (`totalStars === 0`), so it showed on the daily challenge, and afterwards there is no way to see it again.
- There is no way back to the menu from a maze or the map; only closing the app shows it again.
