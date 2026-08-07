---
name: branch-changelog-version-bump
description: >-
  Per ogni branch feature/fix, gestisci versioning e changelog via Changesets
  (make changeset / make changelog / make release). Usare quando si chiude un
  branch, si prepara un PR, o l'utente chiede changelog, bump versione, release
  notes, o sync versioni.
---

# Branch changelog + version bump (Changesets)

Per **ogni branch** shippabile:

1. Aggiungi un changeset locale (`.changeset/*.md`)
2. **Sul medesimo branch ticket**, prima del merge: `make changelog` o `make release` (COMMIT con id PLAT-…)
3. Merge → `master`. Su master niente commit “solo changelog”; al massimo `make create-file` per gli artefatti
4. Versione unica in `package.json`; Expo/Android/iOS la seguono senza script custom

Il file `.changeset/*.md` è obbligatorio per Changesets (non esiste “aggiorna CHANGELOG senza intent”). Si evita il commit orfano su master **consumando** il changeset sul branch del ticket.

Non commitare salvo richiesta esplicita dell'utente.

## Quando attivare

- Fine lavoro su un branch / preparazione PR
- Richieste: "bump versione", "aggiorna changelog", "release", "changeset"
- Dopo integrazioni device/feature strutturali (Polar, Muse, auth, BLE, …)

**Skip** se il branch è solo docs/chore cosmetico senza impatto utente/runtime, oppure se l'utente dice esplicitamente di non bumpare.

Vedi anche la rule always-apply `.cursor/rules/branch-changeset-required.mdc` e `docs/changesets-workflow.md`.

## Source of truth

| Campo | File | Note |
|-------|------|------|
| Intent di release | `.changeset/*.md` | Bump + summary per branch |
| Semver app | `package.json` → `"version"` | Aggiornato da `npx changeset version` |
| Expo | `app.config.js` | Legge `package.json.version` (niente duplicato in `app.json`) |
| Lock | `package-lock.json` | `npm install --package-lock-only` dopo version |
| Android | `android/app/build.gradle` | Deriva da `package.json` — **non editare a mano** |
| iOS marketing | `MARKETING_VERSION` in Xcode / `$(MARKETING_VERSION)` in Info.plist | `xcrun agvtool new-marketing-version` |
| iOS build | `CURRENT_PROJECT_VERSION` / `$(CURRENT_PROJECT_VERSION)` | `xcrun agvtool next-version -all` |

## Workflow

### 1. Contesto branch

```bash
git branch --show-current
git log --oneline master..HEAD
```

### 2. Tipo di bump

| Tipo | Bump | Esempi |
|------|------|--------|
| Breaking / API o store incompatibile | **major** | Cambio `applicationId`, auth breaking |
| Nuova capability utente | **minor** | Nuovo device, nuova schermata |
| Fix, polish, tooling release | **patch** | Bug BLE, UI fix, Changesets/Make release |

Default **patch** se incerto. Utente può forzare major/minor/patch.

### 3. Aggiungi changeset

```bash
make changeset
# oppure: npx changeset add
```

Agent non interattivi: scrivi `.changeset/<slug>.md`:

```md
---
"become-monitor": patch
---

Firma release Android per Play Console e versioning tramite Changesets.
```

### Scrittura summary / CHANGELOG (obbligatoria)

- **Niente** nomi branch, ticket o id tracking (`PLAT-129`, `feat/…`) nel body del changeset né in `CHANGELOG.md`
- Prosa orientata a utente/dev: cosa cambia e perché
- Dopo `make changelog`, **riscrivi** il blocco generato da Changesets (`## 1.x.y` / `### Patch Changes`) nel formato Keep a Changelog del repo:

```markdown
## [X.Y.Z] — Titolo breve leggibile

### Added
- …

### Changed
- …

### Fixed
- …
```

Solo sezioni non vuote. Titolo = prodotto/feature, non id ticket. Italiano, stesso tono delle entry precedenti.

### 4. Changelog finale / release

```bash
make changelog   # changeset version + npm lock + agvtool
make create-file # solo AAB + APK (versione già bumpata)
make release     # changelog + create-file
```

Dopo `make changelog`, riscrivi subito l’entry Keep a Changelog (vedi sopra).  
Non lasciare pendenti `.changeset/*.md` al merge.  
Non aggiungere script di sync versioni custom.

### 5. Verifica

- [ ] Esiste ≥1 file in `.changeset/` sul branch (prima di changelog/release)
- [ ] Dopo `make changelog`: entry Keep a Changelog senza ticket/branch; `package.json` aggiornato
- [ ] iOS `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` aggiornati da agvtool
- [ ] Nessuna modifica accidentale ad Android `versionCode` hardcoded
- [ ] Riassumi all'utente: vecchia → nuova versione + bullet changelog

## Anti-pattern

- Bump/CHANGELOG a mano ignorando `.changeset/`
- Nomi branch/ticket nel CHANGELOG o nel summary del changeset
- Lasciare il blocco grezzo `### Patch Changes` di Changesets
- Script custom tipo `sync-app-version.js`
- Editare `versionCode` / `versionName` in Gradle a mano
- `changeset publish` (non è il flusso di questa app)
- Commit automatico senza richiesta utente
