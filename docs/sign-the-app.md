# Sign the app for the watch

The watch only installs a HAP signed with a debug certificate and a debug profile that lists its UDID (see `choose-a-development-path.md`). Registering the watch is in `developer-account-and-udid.md`.

## Where the signing files live

`C:\Users\hdean\.huawei-signing\counter\`, outside the repo so the key and its password are never committed:

| File | What it is |
|---|---|
| `counter.p12` | Keystore, alias `counter`, EC P-256 key, SHA256withECDSA |
| `password.txt` | Password of the keystore and of the key (the same one) |
| `material/` | Key material hvigor uses to decrypt the passwords in `build-profile.json5` |
| `counter.csr` | Certificate request uploaded to AppGallery Connect |
| `counter.cer` | Debug certificate from AGC (chain of 3 certificates) |
| `counter.p7b` | Debug profile from AGC: `type: debug`, `bundle-name: com.hectorreto.counter`, contains the GT 6 Pro's UDID |

If the key is lost, everything below has to be created again.

## Key and CSR (done with keytool, not DevEco)

DevEco's **Build > Generate Key and CSR** does the same thing in a wizard. We used the keytool that DevEco ships (`E:\Programs\Huawei\DevEco Studio\jbr\bin\keytool.exe`):

```
keytool -genkeypair -alias counter -keyalg EC -groupname secp256r1 -sigalg SHA256withECDSA -validity 9125 -dname "CN=..., O=..., C=MX" -keystore counter.p12 -storetype pkcs12 -storepass <pw> -keypass <pw>
keytool -certreq -alias counter -keystore counter.p12 -storepass <pw> -sigalg SHA256withECDSA -file counter.csr
```

AGC accepted this CSR. Whether DevEco and the watch accept the resulting signature is not checked yet.

## AppGallery Connect (confirmed October 2026)

All under https://developer.huawei.com/consumer/en/service/josp/agc/index.html > **Certificates, app IDs, and profiles**:

1. **Certificates > New certificate**: name `CounterDebug`, type **Debug certificate**, CSR file. Valid one year (expires 2027-10-23). Download gives the `.cer`.
2. **App IDs > New**: type **HarmonyOS app**, name `Counter`, package `com.hectorreto.counter`, category **App**. The next step asks for a project; typing a new name (`huawei-watch`) creates it. No open capabilities are needed; click OK with none checked.
3. **Profiles > Add**: app `Counter`, name `CounterDebugProfile`, type **Debug**, certificate `CounterDebug`, device `GT6Pro`. Click **Add** (top right). Download gives the `.p7b`, valid one year.

The notice after creating the profile about associating the certificate fingerprint in project settings is for services like Push or Account Kit; signing does not need it.

## Gotchas when driving AGC with Claude in Chrome

- The forms live in a same-origin iframe, so `find`/`read_page` do not see them and `file_upload` has no ref to use. The CSR was attached by building a `File` in JavaScript, assigning it to the iframe's `input[type=file]` through a `DataTransfer` and dispatching `change`.
- This Chrome asks where to save each download, and Claude cannot answer that native Save As dialog. Meanwhile the file is already complete in `Downloads` as `<guid>.tmp`; we copied and renamed those. Saving or cancelling the dialog is then up to the user.

## Signing config in the project

`apps/bakery-clicker/build-profile.json5` has a `signingConfigs` entry `default` (`type: HarmonyOS`, `signAlg: SHA256withECDSA`, alias `counter`) with absolute paths to the files above. The other apps use the same keystore, certificate and `material/` with their own profile (`maze.p7b`, `drawinglab.p7b` in the same folder); see `add-a-new-app.md`.

`storePassword` and `keyPassword` are not plain text: hvigor decrypts them (AES-128-GCM, hex) with a key derived from a `material/` folder next to the keystore (`material/fd/{0,1,2}`, `material/ac`, `material/ce`, one file each). DevEco's **File > Project Structure > Signing Configs** creates that folder and the encrypted values. We generated them with a small Node script that mirrors hvigor's `src/utils/decipher-util.js` (in `tools/hvigor/hvigor-ohos-plugin`); the build decrypted them fine. The encrypted values are useless without `material/`, which stays outside the repo. If the material or the password changes, set the passwords again through the DevEco dialog.

## Build from the command line

```
export DEVECO_SDK_HOME="E:/Programs/Huawei/DevEco Studio/sdk"
export PATH="/e/Programs/Huawei/DevEco Studio/jbr/bin:/e/Programs/Huawei/DevEco Studio/tools/node:$PATH"
cd apps/bakery-clicker   # or any other app under apps/
node "E:/Programs/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.js" --mode module -p product=default -p buildMode=debug assembleHap --no-daemon
```

- Without DevEco's `jbr/bin` on `PATH`, `LegacyGenerateLiteCode` fails with `spawn java ENOENT`.
- The first build spends about 40 s in `LegacyCompileLiteJS`; later builds take a few seconds.
- A Lite Wearable build gives two signed packages in `entry/build/default/outputs/default/`: `entry-default-signed.hap` and `bin/entry-default-signed.bin` (the `.bin` is what the watch runs; HuaSideload and Gadgetbridge install `.bin`, DevEco Assistant takes the HAP).
- The warning `can not sign bin with codesign` is printed on every build; the `.bin` is still signed (`sign-app success`) and contains the profile.
- `hap-sign-tool.jar verify-app` passes on the `.hap`. On the `.bin` with `-inForm bin` it fails with `elf magic verify failed`, because that form expects an ELF file, so it is not a valid check for Lite Wearable `.bin` files.

Installing it on the watch is in `install-on-the-watch.md`.
