# Developer account and the watch's UDID

Needed before any install on the watch: the watch only accepts apps signed with a debug profile that lists its UDID (see `choose-a-development-path.md`). Steps below are from Huawei docs and forum guides, not tried yet. Mark each one as confirmed or wrong once done.

## Developer account

- Free, at https://developer.huawei.com/consumer/en/ with a Huawei ID. Mexico (+52) is a listed country for phone sign-up.
- Confirmed October 2026: the first login to developer.huawei.com only registers the forum account (welcome email "registered as a member of HUAWEI Developer Forum"). Verification is the **Identity verification** button in the avatar menu, form at `developer.huawei.com/consumer/en/verified/individual`: name, address, phone, email, then scans of the ID and a bank document, and the message language.
- After sign-up, **identity verification** as an individual developer: a personal ID (passport, INE or driver's license) plus a bank document showing the full name, valid at least 6 months (bank card, statement...). Certificates and profiles cannot be created before it is approved.
- Confirmed October 2026: verification as an individual from Mexico, with a non-China Huawei ID, was **approved** (email "[HUAWEI Developer] You have passed the identity verification.", membership from 2026-10-20). So the China-region requirement one GT 6 owner in Canada reported does not apply to us. Do not create an account as China region: a Huawei ID's region is hard or impossible to change later.
- Individual accounts get fewer services than enterprise ones; debug signing is expected to work for individuals, but that is not confirmed.
- These are steps for the person, not for Claude: creating accounts and uploading IDs or bank documents are done by the user.

## UDID (Android phone)

Confirmed October 2026 on our (non-Huawei) Android phone: these steps gave the UDID, a 64-character hex string.

1. On the Android phone, install **AppGallery** (https://appgallery.huawei.com), then **HUAWEI Health** from AppGallery (the Play Store version may be too old). Choose **Mexico** as service region and sign in with the developer Huawei ID.
   - **DevEco Assistant is not in AppGallery** on a non-Huawei phone (searching for it finds nothing). We installed `HUAWEIDevEcoAssistant_v1.2.1.600.apk` from the unofficial repo https://github.com/megaacheyounes/harmonyos-dev-guide (there is also v1.1.3.641). There is no official checksum. Its signing certificate is `CN=apkkey_devecoassistant_v1, OU=Huawei CBG, O=Huawei, C=CN`, valid from 2023 to 2053, SHA-256 `DC:1C:59:3D:DC:1E:10:74:46:F0:03:FB:35:09:89:0A:73:3A:F5:5B:9C:62:7F:7F:F2:C9:FF:2C:B2:57:00:C8`. This looks like Huawei's, but the certificate is self-signed so that is not proof. Check a download with `keytool -printcert -jarfile <apk>` (keytool is in `E:\Programs\Huawei\DevEco Studio\jbr\bin`).
2. Open DevEco Assistant, go to the **Lite Wearable** tab and tap **Connect**. It opens Health; pair the watch there (if it is paired with the iPhone, it has to be paired with the Android phone instead, which may need a reset of the watch).
3. Back in DevEco Assistant, the watch model and **UDID** appear on screen. Copy it.

Some guides list "Huawei developer account has UDID get permission" as a prerequisite, so DevEco Assistant may ask to sign in with the developer account.

Alternatives if DevEco Assistant is gone or fails: HuaSideload on the iPhone shows the UDID; Gadgetbridge on Android may too (not checked).

## Register the watch in AppGallery Connect

Confirmed October 2026: https://developer.huawei.com/consumer/en/service/josp/agc/index.html > **Certificates, app IDs, and profiles > Devices > Add device**. Older guides say **Users and permissions > Device management**; that menu no longer has it.

The form asks for a name (ours: `GT6Pro`), a type and the UDID (exactly 64 characters). Types offered: Mobile phone, Tablet, PC/2-in-1, Sports watch, Smart watch, Vision, Router. The GT 6 Pro is **Sports watch** (Smart watch is for full-HarmonyOS watches). The list shows the UDID masked and allows up to 100 devices.

Next: debug certificate, app ID and debug profile with this device, in `sign-the-app.md`.

## Sources

- https://medium.com/huawei-developers/harmony-os-prepare-your-lite-wearable-project-for-integration-b4daaa9df67e (DevEco Assistant UDID, Device management)
- https://developer.huawei.com/consumer/en/doc/start/registration-and-verification-0000001053628148 (registration and verification)
- https://developer.huawei.com/consumer/en/doc/help/identityverfication-0000001053292680 (identity verification)
