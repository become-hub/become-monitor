---
name: commit-message-branch-prefix
description: >-
  Formato obbligatorio dei commit git: NOME_BRANCH: short message, senza
  Co-authored-by di Cursor. Usare quando si crea un commit, si fa commit and
  push, o si scrive un messaggio di commit.
---

# Commit message = branch prefix

## Formato obbligatorio

```text
NOME_BRANCH: {short message}
```

- `NOME_BRANCH` = output esatto di `git branch --show-current` (es. `PLAT-129`)
- `{short message}` = una riga breve sul **perché** / cosa shippa (inglese o italiano come lo storico del repo)
- **Niente** body obbligatorio; se serve, dopo una riga vuota
- **MAI** aggiungere trailer `Co-authored-by:` (né Cursor, né altri co-author automatici)

Esempi:

```text
PLAT-129: add Changesets workflow and Play release signing
PLAT-128: update Augmented Monitor app icon across iOS and Android
```

## Checklist prima del commit

1. `git branch --show-current` → usa quel nome come prefisso
2. Messaggio = `NOME_BRANCH: …` (spazio dopo i due punti)
3. HEREDOC / `-m` **senza** righe `Co-authored-by:`
4. Non inventare ticket diversi dal branch corrente

## Anti-pattern

```text
❌ feat: add changesets
❌ PLAT-129 add changesets          (manca ": ")
❌ PLAT-129: …\n\nCo-authored-by: Cursor <…>
❌ Conventional Commits senza prefisso branch
```
