# Known issues and unfinished work

Things that are known to be wrong or unfinished, so they are not mistaken for new regressions. Fix one → remove it here and update the doc it points to.

- **Theme images scaled by the `image` element (October 2026):** each cookie theme is one PNG of about 95 px that the views show at 466, 438, 170, 64 and 40 px. This works in the Previewer but is not yet confirmed on the watch. If the watch draws them small or cropped, the fallback is pre-scaled copies per size (that made a 26 MB HAP; see **Themes** in `create-and-preview-the-app.md`).
