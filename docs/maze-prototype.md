# Maze prototype

A first-person maze, step by step, to see whether that kind of view fits the GT 6 Pro. It is its own app, `apps/maze/` (bundle `com.hectorreto.maze`, name "Maze" on the watch), with the maze on `pages/index/`. It is an original game, not a port of an existing one. Before the apps were split it lived on the branch `laberinto`, with the game moved to `pages/game/` and a long press to open it; that link is gone now that the game is its own app.

## How it works

- **Maze:** 9 x 9 cells on a 19 x 19 grid, carved by a depth-first search from the top-left cell with a small seeded random generator (seeded from the clock). The exit is a door in the outer wall next to the bottom-right cell, drawn green. Reaching it shows "Salida en N pasos" for 1.5 s and makes a new maze.
- **View:** one ray per column, 39 columns of 12 px, cast from the centre of the player's cell with a grid DDA (field of view about 66 degrees). Wall height is 380 / distance px. Colour: x and y faces differ (0.75 brightness on y faces) and walls darken in four distance bands, so a column keeps its colour over small changes.
- **Drawing:** only what changed (as `deltaWalls` in the drawing lab): when a column keeps its colour, only the top and bottom bands it grew or lost; when the colour changes, the whole new wall plus the bands it lost in black. Up to 900 draw calls per canvas, then the canvas is remade and the view drawn in full (a lite canvas takes about 1,100 `fillRect` and has no `clearRect`). In Node, random walks cost about 35-44 rects per action (turns change nearly every column), so the canvas is remade about every 20 actions.
- **Controls:** a full-screen `div` on top takes the taps: the left third (x < 155) turns left, the right third turns right, the bottom (y > 340) turns around, the middle steps forward ("Pared" if there is a wall). The top shows the compass (N, E, S, O) and the steps. The screen is kept on with `brightness.setKeepScreenOn` while the maze is open.
- **Taps need the click's own position:** `ontouchstart` on that `div` (with only `onclick` and `onlongpress` besides) never fired in the Previewer, so the zone read 233,233 every time and every tap stepped forward; the `click` event itself has `globalX` and `globalY`, so `tap(e)` reads them.

## Status

Checked in the Previewer (October 2026, on the branch): the view draws, stepping, both turns, turning around and "Pared" work. On the GT 6 Pro (October 2026, on the branch) it installed over the previous app and everything works: it looks very good, the tap zones respond well, the hitch when the canvas is remade was not noticeable, and reaching the exit makes a new maze. As its own app (October 2026) it builds signed with its own debug profile (see `add-a-new-app.md`) and installs on the watch next to the other apps.
