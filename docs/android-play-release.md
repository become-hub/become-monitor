# Android Play Console release (APK / AAB)

Artifacts for Google Play: **AAB** (required for upload) and optional **APK** (sideload / internal testing).

Version bumps and `CHANGELOG.md` are driven by Changesets — see [changesets-workflow.md](./changesets-workflow.md).

## Prerequisites

1. Java 17 and Android SDK (same as `make android` / `make apk`)
2. Release signing via `android/keystore.properties` (gitignored)
3. For `make release`: at least one pending file in `.changeset/`

```bash
cp android/keystore.properties.example android/keystore.properties
# Edit storeFile, passwords, keyAlias
# Place the .jks under android/app/ (or set an absolute storeFile path)
```

Do **not** commit `keystore.properties` or the upload keystore. Back up the keystore and passwords offline — losing them blocks updates if you are not using Play App Signing only, and always blocks re-creating the same upload key.

## Package / version

| Field | Source |
| --- | --- |
| `applicationId` | `android/app/build.gradle` — must match `app.json` → `expo.android.package` (`com.discoverbecome.augmentedmonitor`) |
| `versionName` | `package.json` `version` (via Changesets / `make changelog`) |
| `versionCode` | derived: `major*10000 + minor*100 + patch` (e.g. `1.2.1` → `10201`) |

Prefer `make release` **on the ticket branch** before merge (changelog + AAB/APK in the same PLAT commit), or `make changelog` on the branch then `make create-file` on `master` after merge. Do not run version bump as an untracked commit on `master`. Expo version follows `package.json` via `app.config.js`.

## Build

```bash
make aab          # App Bundle for Play Console
make apk          # APK (same release signing)
make create-file  # both AAB + APK
make release      # changelog (Changesets) + create-file
```

Outputs:

- AAB: `android/app/build/outputs/bundle/release/become-monitor-v<version>.aab`
- APK: `android/app/build/outputs/apk/release/become-monitor-v<version>.apk`

## Play Console checklist

1. Create the app with package `com.discoverbecome.augmentedmonitor` (or upload to the existing listing with that id).
2. Prefer **Play App Signing** — upload the AAB signed with your upload key.
3. Upload the `.aab` under Production / Testing track.
4. Complete store listing, content rating, Data safety, and target API requirements.

## Notes

- Release builds fail fast if `android/keystore.properties` is missing (debug signing is not used for release).
- Native Kotlin packages may still use the historical namespace `com.gabriele.muscogiuri.becomemonitor`; only `applicationId` is the Play identity.
