# Choose a development path for the Watch GT 6 Pro

Research from October 2026, before writing any code. The DevEco Assistant route has since worked on our watch (see `install-on-the-watch.md`); the other routes are still untried.

## What kind of device it is

The GT 4/5/6 series are **Lite Wearables**: HarmonyOS on LiteOS (RTOS), not the "smart wearable" HarmonyOS of the Watch 4/5 and not Wear OS.

- Apps are **JS FA model**: `.hml` + `.css` + `.js` pages run by the JerryScript engine. ArkTS/Stage packages are rejected (one community report on a GT 6). Android APKs never run.
- `entry/src/main/config.json` has `deviceType: liteWearable`.
- The JS heap is small (plan for about 64 KB) and JerryScript is slow: keep code short.
- The screen is round, 466x466 on the GT 4/5 46 mm; check the GT 6 Pro's exact size before laying out.

## Toolchain confirmed on a real GT 6

`yushu-sjtu/harmonyos-watch-gallery-rtos` (GitHub) says it was "fully verified on physical Huawei Watch GT 6 hardware" with:

- Watch firmware HarmonyOS 6.0.0.165
- DevEco Studio 6.0.1 Release
- Compatible SDK 5.0.5(17), JS FA, "Create a new Lite Wearable project"

Older guides say DevEco 3.1.1 and API 6; that was for the GT 2 Pro / GT 3 (the GT 3 only accepts up to API 6). For the GT 6, start with the versions above.

## Signing is mandatory

The watch itself checks the certificate: it only installs apps signed with a Huawei-issued **debug profile (`.p7b`) that contains this watch's UDID**. Unsigned apps, or apps signed for another watch, fail. This applies to every install route below.

1. Huawei developer account (free) with identity verification, which can take a day or two. One GT 6 owner in Canada reported that signup needed a China region and phone number; this is unconfirmed, check it with our own account.
2. In AppGallery Connect: create a debug certificate (from a CSR made with the SDK tools or DevEco), register the watch as a device ("Sports watch") with its UDID, create an app whose package name matches `bundleName`, and create a debug profile for it.
3. Configure DevEco Studio's signing with the `.p12`, `.cer` and `.p7b`, then build the HAP.

The UDID comes from DevEco Assistant (Android) or HuaSideload (iPhone).

## Install routes

| Route | Phone | Status |
|---|---|---|
| **DevEco Assistant** (Huawei's official app, from AppGallery) | Android with Huawei Health from AppGallery | **Works on our GT 6 Pro** (October 2026, DevEco Assistant v1.2.1.600 from an unofficial APK, since it is not in AppGallery on a non-Huawei phone). Copy the HAP to `/sdcard/haps/`, open DevEco Assistant, tap "Install watch app". A GT 5 user got "Installation failed: 40. Invalid configuration file format" with no answer in the thread: usually an API level or `deviceType` mismatch. |
| **HuaSideload** (`Burak4Arslan/huawei-watch-sideload-ios`, AGPL) | iPhone, built with Xcode on a **Mac** | Community port of Gadgetbridge's Huawei protocol. Installs signed `.bin` packages with a debug profile, shows the UDID. Tested only on a GT 3 SE (API 6); its build pipeline uses DevEco 3.1 / API 9 SDK and Node 16. Pairing may break the Health connection. |
| **Gadgetbridge** (open source, Android) | Android, without Huawei Health | Supports the GT 6 Pro (nightly builds) including "app management", but app install needs the same signed `.bin`. Connecting to Gadgetbridge may require resetting the watch. |
| **AppGallery in Huawei Health** | Either | Only for published apps. Store review is not a development loop. |

The Flappy Bird on our watch is most likely a published AppGallery app, so it proves what the platform can run, not that self-built apps can be sideloaded.

## Recommended order

1. Install DevEco Studio 6.0.1 on Windows, create a Lite Wearable JS project, and write the counter. Check it in the **Previewer** (no account or watch needed).
2. Create the Huawei developer account and see whether verification works from our region.
3. On the Android phone: Huawei Health and DevEco Assistant from AppGallery, pair the watch, read the UDID.
4. Create the certificate and profile, sign, install with DevEco Assistant.
5. If DevEco Assistant fails on the GT 6 Pro, try Gadgetbridge (Android) with the same signed package, then HuaSideload (we have a Mac and an iPhone for it).

Steps 1 to 4 are done, with DevEco Studio 6.1.1 instead of 6.0.1: the signed counter installed on the watch with DevEco Assistant, so step 5 was not needed. See `create-and-preview-the-app.md`, `developer-account-and-udid.md`, `sign-the-app.md` and `install-on-the-watch.md`.

## Sources

- https://github.com/yushu-sjtu/harmonyos-watch-gallery-rtos (GT 6 toolchain) and its issue #1 (account region, UDID)
- https://github.com/Burak4Arslan/huawei-watch-sideload-ios (iPhone route, signing, JerryScript limits)
- https://codeberg.org/Freeyourgadget/Gadgetbridge/issues/5428 (GT 6 Pro support) and #4175 (watch checks the certificate)
- https://medium.com/huawei-developers/running-lite-wearable-apps-on-huawei-gt-devices-d4d26db1251c (DevEco Assistant route)
- https://github.com/Explore-In-HMOS/hmos-index (Lite Wearable project layout, Previewer)
