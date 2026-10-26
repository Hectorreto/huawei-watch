# Known issues and unfinished work

Things that are known to be wrong or unfinished, so they are not mistaken for new regressions. Fix one → remove it here and update the doc it points to.

- **Blurry theme cookies on the watch (October 2026):** each cookie theme is one PNG of about 95 px that the views show at 466, 438, 170, 64 and 40 px. The watch upscales it with a smooth filter, so the pixel art looks blurry. Fix in progress: store the images already scaled with nearest neighbour. See **Themes** in `create-and-preview-the-app.md`.
