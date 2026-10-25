# Create a Lite Wearable project and check it in the Previewer

## Setup on the Windows PC

- DevEco Studio **6.1.1** (build 243.24978.46.36.611280) at `E:\Programs\Huawei\DevEco Studio`. It was downloaded from https://developer.huawei.com/consumer/en/download/, which needs a Huawei ID login. winget's `Huawei.DevEco` only has 3.1.0.
- The bundled SDK is HarmonyOS 6.1.1(24) at `E:\Programs\Huawei\DevEco Studio\sdk\default`. It includes the Lite Wearable previewer (`openharmony/previewer/liteWearable`), so no extra SDK download was needed. DevEco also brings its own Node and ohpm under `tools/`.
- User data lives in `%LOCALAPPDATA%\Huawei\` and `%APPDATA%\Huawei\DevEcoStudio6.1`.

## Creating the project

File > New > Create Project > Application > **[Lite]Empty Ability** (the template with a watch icon). It is JS, FA model, `deviceType: liteWearable`. The template accepts compatible SDKs 4.0.0(10) to 6.1.1(24).

`Counter/` was created with:

| Field | Value |
|---|---|
| Project name | Counter |
| Bundle name | `com.hectorreto.counter` (the AppGallery Connect app must use the same package name) |
| Save location | `huawei-watch\Counter` |
| Compatible SDK | **5.0.0(12)**, the lowest common value that GT 6 projects use; the confirmed GT 6 project used 5.0.5(17), which this DevEco does not list |
| Target SDK | 6.1.1(24), set by the wizard in `build-profile.json5` |

The first sync shows "Project sync failed" while ohpm installs packages; it retries on its own and finishes in about 30 s. Ignore the banner if the Sync tab ends with exit code 0.

Driving the wizard with computer use: DevEco Studio is granted at **full** tier (typing works), because it is not recognised as an IDE.

## The app

`entry/src/main/js/MainAbility/pages/index/`: `index.hml` is a full-screen `div` with `onclick="increment"` holding one `text`; `index.js` keeps `count` in `data`; `index.css` makes the background black and the text white. Tapping anywhere on the screen counts, not only on the number.

The name on the watch is `MainAbility_label` in `entry/src/main/resources/base/element/string.json` ("Cookie Clicker"); the template's default is "label". The launcher icon is `resources/base/media/icon.png` (104x104) and `icon_small.png` (92x92), RGBA PNGs; the template's default is a blue square with four white squares. Our cookie icon was drawn with a small pure-Python PNG script (Pillow is not installed on this PC).

## Previewer

Open `index.hml` and click **Previewer** on the right edge. It builds (`buildPreviewerResource`, a few seconds) and shows a round LiteWearable watch. Clicks on the screen act as taps.

- Clicks less than about a second apart counted once (three quick clicks → 1). Clicks two seconds apart each counted. Not yet checked whether a real watch behaves the same.
- The default text size (38px) looks small on the round screen. Lite Wearable only accepts some font sizes; try larger ones in the Previewer before changing it.
