# Changesets workflow

Versioning and branch changelogs for Augmented Monitor use [@changesets/cli](https://github.com/changesets/changesets) on the root package `become-monitor` (private app — not published to npm).

## Why the `.changeset/*.md` file exists

Changesets **cannot** invent a changelog entry without an intent file. The `.changeset/<name>.md` is that intent (bump + summary).  
`make changelog` (`npx changeset version`) **consumes** it and writes `CHANGELOG.md` + bumps `package.json`, then deletes the intent file.

You do **not** leave that step for `master` as a second untracked commit.

## Correct flow (version on the ticket branch)

```text
PLAT-129 (feature branch)
  1. work + make changeset   (or write .changeset/*.md)
  2. make changelog          (or make release = changelog + AAB/APK)
  3. commit everything under PLAT-129  ← CHANGELOG + version in the same ticket
  4. PR / merge → master

master
  - only make create-file if you still need AAB/APK and did not build on the branch
  - no orphan “version packages” commit without ticket id
```

| Where | What |
| --- | --- |
| Feature branch (`PLAT-…`) | `make changeset` → later `make changelog` or `make release`, then commit |
| `master` after merge | Optional `make create-file` only (artifacts). Version/CHANGELOG already in the merge |

## Single version source

`package.json` `"version"` is the only marketing version to bump (via Changesets).

| Consumer | How it follows |
| --- | --- |
| Expo / JS UI | [`app.config.js`](../app.config.js) sets `expo.version` from `package.json` |
| Android | `android/app/build.gradle` already reads `package.json` |
| npm lock | `npm install --package-lock-only` after `changeset version` |
| iOS | Info.plist uses `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)`; `xcrun agvtool` updates Xcode |

## Commands

| Command | What it does |
| --- | --- |
| `make changeset` | `npx changeset add` — interactive bump + summary |
| `make changelog` | `npx changeset version` + `npm install --package-lock-only` + `agvtool` |
| `make create-file` | Signed AAB + APK for the current `package.json` version |
| `make release` | `make changelog` then `make create-file` — run on the **ticket branch** before merge |
| `npm run release` | Same as `make release` |

Requires pending `.changeset/*.md` (not only `config.json` / README) for `make changelog` / `make release`.

Android signing: see [android-play-release.md](./android-play-release.md) (`android/keystore.properties`).

## Bump guide

| Bump | When |
| --- | --- |
| `major` | Breaking / store-incompatible |
| `minor` | New user-facing capability |
| `patch` | Fix, polish, release tooling |

## Agent / non-interactive

Write an official Changesets file:

```md
---
"become-monitor": patch
---

Short user-facing summary (no PLAT-/branch names).
```

After `make changelog`, reshape the generated entry into Keep a Changelog (`## [X.Y.Z] — Title` + Added/Changed/Fixed). No ticket or branch ids in `CHANGELOG.md`.

Do **not** use `changeset publish` for this app. Do **not** add custom version-sync scripts.  
Do **not** run `make changelog` on `master` as a standalone commit without a ticket id.
