# Known issues and unfinished work

Things that are known to be wrong or unfinished, so they are not mistaken for new regressions. Fix one → remove it here and update the doc it points to.

- **Theme cookies may look soft on the watch (October 2026):** each cookie theme is one PNG of about 190 px (1/6 of the source) that the views show at 466, 438, 170, 64 and 40 px. The watch upscales with a smooth filter; at 1/12 (about 95 px) the big cookie looked blurry. The 1/6 version is not yet checked on the watch. If it still looks blurry, store the big cookie already scaled to 466 px with nearest neighbour. See **Themes** in `create-and-preview-the-app.md`.
