---
name: native-tools-and-versioning
description: >-
  Preferisce sempre strumenti nativi al posto di script bash/Node custom, e
  applica la metodologia Changesets corretta per bump versione e changelog.
  Usare quando si propongono script di sync, Makefile wrapper custom, bump
  versione, CHANGELOG, release, app.config, Info.plist, o tooling di build.
---

# Native tools + versioning methodology

## 1. Non fare script bash — andare sempre verso una soluzione nativa

**Regola:** non creare script bash/Node “colla” (es. `sync-*.js`, `bump-version.sh`) per copiare valori tra file o orchestrare tool già esistenti.

Ordine di preferenza:

1. **Comando ufficiale del tool** (`npx changeset …`, `npm install --package-lock-only`, `xcrun agvtool`, `./gradlew …`)
2. **Config nativa del ecosystem** (Expo `app.config.js`, Gradle che legge `package.json`, Info.plist con `$(MARKETING_VERSION)`)
3. **Thin Make target** che invoca solo quei comandi (niente logica duplicata)
4. Script custom **solo** se l’utente lo chiede esplicitamente **e** non esiste alternativa nativa

```text
❌ BAD: scripts/sync-app-version.js che copia package.json → app.json / Info.plist
✅ GOOD: app.config.js legge package.json; agvtool aggiorna iOS; Gradle legge package.json
```

Make può chiamare tool nativi; non deve nascondere un mini-framework in shell/Node.

Dettaglio Changesets/release: `docs/changesets-workflow.md`.

## 2. Metodologia corretta per aggiornare una versione

Source of truth unica: **`package.json` → `"version"`**, aggiornata solo da Changesets.

### Su ogni branch shippabile (non su master “nudo”)

1. Aggiungi intent di release (non bumpare a mano):
   - `make changeset` / `npx changeset add`, oppure file ufficiale `.changeset/<name>.md`
2. Scegli bump: `patch` | `minor` | `major` (entità del task)
3. **Prima del merge**, sullo stesso branch: `make changelog` o `make release`, poi commit con id ticket
4. Dopo merge a `master`: solo eventuali artefatti (`make create-file`), niente commit version-only senza ticket

Changesets non scrive il CHANGELOG senza `.changeset/*.md`. Il punto è **quando** lo consumi: sul branch ticket, non in un secondo commit su master.

Equivalente nativo (senza reinventarlo):

1. `npx changeset version` → `package.json` + `CHANGELOG.md`
2. `npm install --package-lock-only` → lock
3. `xcrun agvtool new-marketing-version <ver>` + `xcrun agvtool next-version -all` → iOS
4. Expo: `app.config.js` espone già `version` da `package.json`
5. Android: `versionName` / `versionCode` già derivati da `package.json` in Gradle

### Cosa non fare

| Anti-pattern | Perché |
| --- | --- |
| Editare `app.json` `version` | Duplicato; Expo legge `package.json` via `app.config.js` |
| Hardcodare versioni in Info.plist | Usare `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)` |
| Editare `versionCode` in Gradle a mano | Formula già in `android/app/build.gradle` |
| Script di sync versioni | Violazione sezione 1 |
| `changeset publish` | App store, non npm publish |
| `make changelog` solo su `master` senza ticket | Commit orfano senza id tracking |

Skill operativa dettagliata: `.cursor/skills/branch-changelog-version-bump/SKILL.md`.  
Rule obbligo changeset: `.cursor/rules/branch-changeset-required.mdc`.
