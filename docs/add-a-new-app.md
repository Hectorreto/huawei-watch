# Add a new app

Each app is its own DevEco project under `apps/`, because an app always starts at `pages/index/index` (see `compare-drawing-methods.md`), and each has its own `bundleName` so they install side by side on the watch.

| App | Bundle name | Debug profile |
|---|---|---|
| `apps/bakery-clicker/` | `com.hectorreto.counter` (kept from the first project; changing it would make a new app on the watch and lose the save) | `counter.p7b` |
| `apps/maze/` | `com.hectorreto.maze` | `maze.p7b` (not created yet) |
| `apps/drawing-lab/` | `com.hectorreto.drawinglab` | `drawinglab.p7b` (not created yet) |

## Steps

1. **Copy a project.** Copy the tracked files of `apps/bakery-clicker/` to `apps/<name>/`, without `entry/src/main/js/MainAbility/common/` (the game's images) and `pages/`, then write `pages/index/index.{hml,css,js}`. Copy only the images the new page uses. Do not copy `entry/build`, `oh_modules` or `.hvigor`. (The DevEco wizard, `create-and-preview-the-app.md`, also works, but then the SDK settings and `.gitignore` have to be matched by hand.)
2. **Set the names.** `bundleName` in `entry/src/main/config.json` (`com.hectorreto.<name>`, lowercase letters and dots) and the name on the watch, `MainAbility_label` in `entry/src/main/resources/base/element/string.json`.
3. **AppGallery Connect** (the user does this; details and gotchas in `sign-the-app.md`): under **Certificates, app IDs, and profiles**:
   - **App IDs > New**: HarmonyOS app, package = the new `bundleName`, project `huawei-watch`, no capabilities.
   - **Profiles > Add**: that app, type **Debug**, certificate `CounterDebug`, device `GT6Pro`. Download the `.p7b`.
   - The certificate, the keystore and the registered watch are reused; no new CSR or certificate is needed.
4. **Signing config.** Save the profile as `C:\Users\hdean\.huawei-signing\counter\<name>.p7b` and point `profile` in `apps/<name>/build-profile.json5` there. Leave the other fields as copied: `certpath`, `storeFile`, the alias and the encrypted passwords stay those of `counter`, and must stay in that folder, since hvigor decrypts the passwords with the `material/` folder next to the keystore.
5. **Build** from `apps/<name>/` with the command in `sign-the-app.md`, and check the Previewer first (open `apps/<name>/` as the project in DevEco).
6. **Install** `apps/<name>/entry/build/default/outputs/default/entry-default-signed.hap` with DevEco Assistant (`install-on-the-watch.md`).

## Without the profile

Until the `.p7b` exists, the build still compiles (`LegacyCompileLiteJS`, `LegacyGenerateLiteCode`) and writes `outputs/default/bin/entry-default-unsigned.bin`, then fails at `LegacySignLiteBin` with `00303107 Configuration Error ... Invalid profile value` (checked October 2026 for maze and drawing-lab). No HAP is written, so there is nothing to install. The Previewer does not need signing. Do not sign a new app with `counter.p7b`: the profile names `com.hectorreto.counter`, so the bundle name would not match.
