# ArthoLingo v2.5 — Developer Architecture

## Canonical source tree

- `app.js` — application coordinator / UI orchestration.
- `app.css` — CSS entry point.
- `app-legacy.css` — existing visual system kept intact for regression safety.
- `src/styles/quality-overrides.css` — small visual overrides.
- `word-classes.js` — stopwords and grammar/function-word sets.
- `content-safety.js` — pre-translation safety gate and Bengali output gate.
- `dictionary-engine.js` — local allowlist dictionary lookup.
- `pdf-generator.js` — PDF rendering/export service.
- `src/data/dictionary/approved/` — only data allowed at runtime.
- `src/data/dictionary/lexicon/` — lexical candidate lists; not automatically approved for meaning display.
- `src/data/dictionary/sources/` — drop zone for license-cleared source files.
- `src/data/dictionary/generated/` — Python validation/build tooling.
- `./` — app icons and favicon assets.

## Safety rule

The vocabulary engine is local-only. A word not present in the approved dictionary is not sent to any translation API and receives no guessed Bengali meaning.

Sentence translation may use external sentence-translation providers, but the safety engine runs before any external request.

## 10K lexical index

`artholingo-lexicon-10k.txt` contains 10,000 English lexical candidates. It is intentionally NOT an approved meaning database. Only verified English→Bengali entries in `approved/artholingo-dictionary.json` are displayed as vocabulary meanings.

This avoids the original failure mode: a large but unverified source can be worse than a smaller, trusted dictionary.
