# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MedVoice is a Romanian-language **PWA** (Progressive Web App) for medical staff. A user uploads a DOCX template with `{{placeholder}}` fields, dictates values for each field by voice, then downloads a filled DOCX or PDF. Everything runs in the browser with no backend — all state lives in IndexedDB.

Deployed on Vercel. No build step, no package.json — pure HTML/CSS/JS served as static files.

## Running locally

Open `index.html` directly in Chrome, or serve from any static server:

```bash
npx serve .          # or: python3 -m http.server 8080
```

Voice dictation requires `https://` or `localhost` (browser microphone permission). On a plain `file://` origin the mic button will be disabled.

## Architecture

All JS is loaded as plain `<script>` tags in `index.html` in this order, each an IIFE assigned to a global:

| File | Global | Responsibility |
|---|---|---|
| `js/storage.js` | `Storage` | IndexedDB wrapper — templates, sessions, drafts, suggestions, locked fields |
| `js/template.js` | `Template` | Parse `.docx` with PizZip, extract `{{key}}` placeholders, map to field definitions |
| `js/voice.js` | `Voice` | Web Speech API wrapper (Romanian `ro-RO`); emits callbacks consumed by `app.js` |
| `js/docgen.js` | `DocGen` | Fill template with user values via docxtemplater; includes XML preprocessing to fix fragmented placeholders |
| `js/app.js` | _(IIFE, no export)_ | All UI logic: 4-screen SPA, field state machine, voice callbacks, history/draft management |

CDN dependencies loaded before the app scripts: **PizZip**, **docxtemplater**, **FileSaver.js**.

### Screen flow

```
screen-upload → screen-dictation → screen-generate
                                 ↕
                           screen-history (overlay)
```

Screens are `<div id="screen-*">` toggled with `.active` class. `showScreen(name)` in `app.js` is the single transition point.

### Placeholder detection (`template.js`)

`extractPlaceholders()` reads `word/document.xml` plus headers/footers, strips XML tags, then finds `{{key}}` patterns. Keys are matched against `DEFAULT_FIELDS` for Romanian labels; unknown keys get a title-cased label via `labelFor()`.

### DOCX generation quirk (`docgen.js`)

Word fragments `{{placeholders}}` across multiple XML `<w:r>` runs, inserting `<w:proofErr>`, bookmarks, and tracked-change markers between characters. `preprocessXML()` repairs this before passing to docxtemplater. It also forces Times New Roman 12pt black on all placeholder runs so the filled values look like body text regardless of template styling.

### Storage schema (IndexedDB `medvoice-db` v4)

- `templates` — raw DOCX bytes + extracted field definitions
- `sessions` — completed fills (values snapshot)
- `drafts` — in-progress fill autosaved per template
- `suggestions` — per-field frequency table for autocomplete chips
- `lockedFields` — per-template fields that carry over between patients (e.g., doctor name)

### Service worker (`service-worker.js`)

Cache name is `medvoice-v{N}`. **When adding new assets, increment the version number** so old caches are evicted on activate. Navigation requests are network-first; all other requests are cache-first.

### Voice (`voice.js`)

Uses `webkitSpeechRecognition` / `SpeechRecognition` with `lang='ro-RO'`, `continuous=true`, `interimResults=true`. Auto-restarts on `onend` while `_isRecording` is true (handles silent-pause disconnects). The `_generation` counter ensures stale results from a previous recording session are discarded.

Date fields (`data_nasterii`, `perioada`, `data`) run through `_convertSpokenDate()` in `app.js`, which converts spoken Romanian ordinal day + month name + year into `DD.MM.YYYY`.

## Key conventions

- **No framework, no bundler.** Plain ES5-compatible JS (IIFEs, `var`-free but no ESM). Keep it that way.
- **Romanian UI strings** — all user-facing text is in Romanian.
- **`escHtml()`** must be used whenever inserting user-provided strings into `innerHTML`.
- **Draft autosave** is triggered on every field confirm via `Storage.saveDraft()`, cleared on download/share.
- Locked fields persist per template across sessions — changes to lock state update IndexedDB immediately via `Storage.setLockedFields()`.
- PDF export uses `window.print()` with a hidden `#print-container` div styled via `@media print` in `app.css`.
