---
name: branch-changelog-version-bump
description: >-
  Per ogni branch feature/fix, aggiorna CHANGELOG.md e fa bump di versione
  dell'app (package.json, app.json, iOS Info.plist). Usare quando si chiude un
  branch, si prepara un PR, o l'utente chiede changelog, bump versione, release
  notes, o sync versioni.
---

# Branch changelog + version bump

Per **ogni branch** che introduce lavoro shippabile (feature, fix, refactor rilevante), prima di PR/merge:

1. Bump versione semver
2. Aggiorna `CHANGELOG.md`
3. Allinea tutti i file versione

Non commitare salvo richiesta esplicita dell'utente.

## Quando attivare

- Fine lavoro su un branch / preparazione PR
- Richieste: "bump versione", "aggiorna changelog", "release", "versione app"
- Dopo integrazioni device/feature strutturali (Polar, Muse, auth, BLE, …)

**Skip** se il branch è solo docs/chore cosmetico senza impatto utente/runtime, oppure se l'utente dice esplicitamente di non bumpare.

## Source of truth

| Campo | File | Note |
|-------|------|------|
| Semver app | `package.json` → `"version"` | Primario |
| Expo | `app.json` → `expo.version` | Deve = package.json |
| Lock | `package-lock.json` root `"version"` + package `""` `"version"` | Deve = package.json |
| Android | `android/app/build.gradle` | Legge `package.json`; `versionCode = major*10000 + minor*100 + patch` — **non editare a mano** |
| iOS marketing | `ios/becomemonitor/Info.plist` → `CFBundleShortVersionString` | Deve = package.json |
| iOS build | stesso plist → `CFBundleVersion` | Intero: incrementa di **+1** a ogni bump |

`CHANGELOG.md` top entry `[X.Y.Z]` deve corrispondere alla nuova versione.

## Workflow

### 1. Contesto branch

```bash
git branch --show-current
git log --oneline main..HEAD   # o master / origin/main se diverso
git diff main...HEAD --stat
```

Leggi la versione attuale da `package.json` e l'ultima sezione in `CHANGELOG.md`. Se divergono, allinea al **max** semver tra i due, poi applica il bump.

### 2. Tipo di bump

Default da Conventional Commits / natura del diff:

| Tipo | Bump | Esempi |
|------|------|--------|
| Breaking / API o store incompatibile | **major** `X.0.0` | Cambio package Android, auth breaking |
| Nuova capability utente (device, flusso, schermata) | **minor** `x.Y.0` | Nuovo device Polar/Muse, nuova tab |
| Fix, polish, refactor non breaking | **patch** `x.y.Z` | Bug BLE, UI fix, docs strutturali con fix |

Se il repo storicamente usa solo patch per integrazioni (es. 1.0.1 H10, 1.0.2…), rispetta la convenzione del branch/team quando l'utente non specifica altrimenti — **default patch** se incerto; chiedi solo se major vs minor è ambiguo.

Utente può forzare: `bump major|minor|patch`.

### 3. Aggiorna versioni

Scrivi la nuova `X.Y.Z` in:

1. `package.json` → `"version"`
2. `app.json` → `expo.version`
3. `package-lock.json` → due campi root version (come sopra)
4. `ios/becomemonitor/Info.plist` → `CFBundleShortVersionString` = `X.Y.Z`
5. `ios/becomemonitor/Info.plist` → `CFBundleVersion` = precedente + 1

Non toccare `android/app/build.gradle` (deriva da package.json).

### 4. Aggiorna CHANGELOG.md

Formato Keep a Changelog (IT), come le entry esistenti:

```markdown
## [X.Y.Z] — Titolo breve (branch/feature)

### Added
- …

### Changed
- …

### Fixed
- …

### Removed
- …
```

Regole:

- Inserisci la nuova sezione **subito sotto** l'intestazione (dopo le righe introduttive), sopra le versioni precedenti
- Titolo: nome prodotto/feature o branch human-readable (es. `Muse 2`, `Polar H10`)
- Solo sezioni non vuote (`Added` / `Changed` / `Fixed` / `Removed`)
- Bullet orientati all'utente/dev: cosa e perché, non dump di file
- Italiano, tono delle entry esistenti
- Deduci i punti da `git log` + diff del branch (non inventare feature non presenti)

### 5. Verifica

- [ ] `package.json` version = `app.json` expo.version = Info.plist short version = CHANGELOG top `[X.Y.Z]`
- [ ] `CFBundleVersion` incrementato
- [ ] Nessuna modifica accidentale ad Android versionCode hardcoded
- [ ] Riassumi all'utente: vecchia → nuova versione + elenco bullet changelog

## Esempio

Branch `feat/muse-2`, versione `1.0.2` → bump patch → `1.0.3`:

- `package.json` / `app.json` / lock / iOS short → `1.0.3`
- `CFBundleVersion` `3` → `4`
- CHANGELOG:

```markdown
## [1.0.3] — Muse 2

### Added
- Integrazione Muse 2 (BLE GATT, EEG/HR in Monitor)
```

## Anti-pattern

- Bump senza entry CHANGELOG (o viceversa)
- Versioni diverse tra package.json e app.json / iOS
- Editare `versionCode` / `versionName` in Gradle a mano
- Bump su `main` senza branch di lavoro (salvo hotfix esplicito)
- Commit automatico del bump senza richiesta utente
