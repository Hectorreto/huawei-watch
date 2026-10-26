# Known issues and unfinished work

Things that are known to be wrong or unfinished, so they are not mistaken for new regressions. Fix one → remove it here and update the doc it points to.

- **Package size with themes (October 2026):** with ten cookie themes the HAP is about 26 MB, up from 3.9 MB, and it has not been installed on the watch yet. A community post says HAPs near 10 MB may fail to install on some Huawei watches (not an official limit). If the install fails, the pressed images (`common/themes/<id>_pressed.png`, 10 × about 1.1 MB in the package) are the first thing to drop. See **Themes** in `create-and-preview-the-app.md`.
