# Install the app on the watch

Confirmed October 2026: the signed counter installed on our Watch GT 6 Pro through DevEco Assistant on the (non-Huawei) Android phone. Building the signed package is in `sign-the-app.md`; getting DevEco Assistant and pairing the watch is in `developer-account-and-udid.md`.

## Steps

1. Build: `Counter/entry/build/default/outputs/default/entry-default-signed.hap`.
2. Copy the HAP to the Android phone into a folder named **`haps`** at the root of internal storage: `/storage/emulated/0/haps/` (same as `/sdcard/haps/`). A HAP left directly in `/storage/emulated/0` is not the documented location; DevEco Assistant looks in `haps`.
3. With the watch paired in HUAWEI Health, open **DevEco Assistant** (v1.2.1.600) and tap **Install watch app**, then pick the HAP.

The `.hap` worked. It is a zip holding only `entry-default-signed.bin`, the same signed `.bin` the build writes to `bin/`.

## Switching the watch back to the iPhone

Confirmed October 2026: after unpairing the watch from the Android phone and pairing it again with the iPhone (HUAWEI Health), the installed app stayed on the watch and still runs. Installing a new version needs the Android phone and DevEco Assistant again, which means pairing the watch with Android again (HuaSideload on the iPhone is untested).

## What it proves

- The counter opens on the watch and the number goes up by 1 on every tap.

- Self-built apps can be sideloaded on the GT 6 Pro with an individual developer account from Mexico, a debug certificate and a debug profile listing the watch's UDID.
- Compatible SDK 5.0.0(12) and target SDK 6.1.1(24) are accepted by this watch.
- The "Installation failed: 40" error reported for a GT 5 did not happen here.
