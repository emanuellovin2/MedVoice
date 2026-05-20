# Graph Report - /Users/lovinemanuel/Desktop/MedVoice  (2026-05-20)

## Corpus Check
- Corpus is ~8,852 words - fits in a single context window. You may not need a graph.

## Summary
- 158 nodes · 247 edges · 24 communities (11 shown, 13 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.92)
- Token cost: 9,200 input · 2,800 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Rendering & Theming|UI Rendering & Theming]]
- [[_COMMUNITY_App Bootstrap & DocGen|App Bootstrap & DocGen]]
- [[_COMMUNITY_Voice Dictation Control|Voice Dictation Control]]
- [[_COMMUNITY_Medical UX & Screen Init|Medical UX & Screen Init]]
- [[_COMMUNITY_Session & Navigation Flow|Session & Navigation Flow]]
- [[_COMMUNITY_PWA Manifest|PWA Manifest]]
- [[_COMMUNITY_SVG Icon Components|SVG Icon Components]]
- [[_COMMUNITY_App Icon Assets|App Icon Assets]]
- [[_COMMUNITY_Voice Auto-restart Logic|Voice Auto-restart Logic]]
- [[_COMMUNITY_Vercel Deployment Config|Vercel Deployment Config]]
- [[_COMMUNITY_Vercel Project Docs|Vercel Project Docs]]
- [[_COMMUNITY_Claude Settings|Claude Settings]]
- [[_COMMUNITY_Service Worker Cache|Service Worker Cache]]
- [[_COMMUNITY_PWA App Identity|PWA App Identity]]
- [[_COMMUNITY_Vercel Project Root|Vercel Project Root]]
- [[_COMMUNITY_Offline-First Design|Offline-First Design]]
- [[_COMMUNITY_Punctuation Field Segments|Punctuation Field Segments]]
- [[_COMMUNITY_Template Current State|Template Current State]]
- [[_COMMUNITY_Previous Field Render|Previous Field Render]]
- [[_COMMUNITY_Upload Screen|Upload Screen]]
- [[_COMMUNITY_Dictation Screen|Dictation Screen]]
- [[_COMMUNITY_Generate Screen|Generate Screen]]
- [[_COMMUNITY_History Screen|History Screen]]
- [[_COMMUNITY_Claude Local Config|Claude Local Config]]

## God Nodes (most connected - your core abstractions)
1. `$()` - 27 edges
2. `startDictation()` - 14 edges
3. `confirmField()` - 14 edges
4. `toast()` - 11 edges
5. `setActiveField()` - 11 edges
6. `App Controller (IIFE)` - 9 edges
7. `index.html (SPA entry point)` - 9 edges
8. `hideConfirm()` - 8 edges
9. `setMicState()` - 7 edges
10. `doDownload()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Voice Dictation Medical Workflow` --rationale_for--> `Voice`  [INFERRED]
  context.md → js/voice.js
- `MedVoice App Icon 512px` --conceptually_related_to--> `App Controller (IIFE)`  [INFERRED]
  icons/icon-512.png → js/app.js
- `index.html (SPA entry point)` --references--> `DocGen`  [EXTRACTED]
  index.html → js/docgen.js
- `index.html (SPA entry point)` --references--> `Voice`  [EXTRACTED]
  index.html → js/voice.js
- `MedVoice PWA Concept` --rationale_for--> `MedVoice PWA Manifest`  [INFERRED]
  context.md → manifest.json

## Hyperedges (group relationships)
- **PWA Offline Stack** — manifest_app, service_worker_sw, js_storage_indexeddb, context_offline_first [INFERRED 0.90]
- **MedVoice PWA Core Modules** — service_worker, index_html, js_app_app, js_storage_storage, js_voice_voice, js_template_template, js_docgen_docgen [INFERRED 0.95]
- **DOCX Generation Pipeline** — js_template_loadfromfile, js_docgen_preprocessxml, js_docgen_fixduplicatedelimiters, js_docgen_generatedocx, lib_pizzip, lib_docxtemplater, lib_filesaver [EXTRACTED 1.00]
- **Voice Dictation Field-Fill Flow** — js_voice_voice, js_app_startdictation, js_app_setactivefield, js_app_confirmfield, js_storage_drafts, js_storage_suggestions [INFERRED 0.95]
- **Offline Persistence Layer (IndexedDB stores)** — js_storage_storage, js_storage_templates, js_storage_sessions, js_storage_drafts, js_storage_suggestions, js_storage_lockedfields [EXTRACTED 1.00]

## Communities (24 total, 13 thin omitted)

### Community 0 - "UI Rendering & Theming"
Cohesion: 0.09
Nodes (20): applyTheme(), btn, _buildFileName(), container, dateStr, doDownload(), empty, _fieldDefs (+12 more)

### Community 1 - "App Bootstrap & DocGen"
Cohesion: 0.11
Nodes (19): configurations, version, index.html (SPA entry point), IndexedDB (browser storage), App State (_fields, _fieldDefs, _currentIdx, etc.), DocGen, fixDuplicateDelimiters, DocGen.generateBlob (+11 more)

### Community 2 - "Voice Dictation Control"
Cohesion: 0.22
Nodes (21): $(), Auto-Advance Mic (voice moves to next field automatically), confirmField(), haptic(), hideConfirm(), onClearField(), onError(), onFieldComplete() (+13 more)

### Community 3 - "Medical UX & Screen Init"
Cohesion: 0.12
Nodes (17): DOCX Placeholder Auto-Detection, Medical Fields (pacient, diagnostic, tratament), Voice Dictation Medical Workflow, MedVoice App Icon 512px, App Controller (IIFE), initHistoryScreen(), initUploadScreen(), updateGreeting() (+9 more)

### Community 4 - "Session & Navigation Flow"
Cohesion: 0.23
Nodes (14): Draft Resume (continue where you left off), handleUpload(), Locked Fields (pre-filled persistent values per template), onGenerateDoc(), onPrevField(), renderPreview(), showScreen(), startDictation() (+6 more)

### Community 5 - "PWA Manifest"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, lang, name, orientation (+4 more)

### Community 6 - "SVG Icon Components"
Cohesion: 0.36
Nodes (9): Dark Navy Rounded Rectangle Background, Blue Circle Background Element, MedVoice App Branding Icon, Microphone Arc / Sound Pickup Path, Microphone Base Horizontal Line, Microphone Body (White Rounded Rectangle), Microphone Stand Vertical Line, Microphone Symbol (Composed Shape) (+1 more)

### Community 7 - "App Icon Assets"
Cohesion: 0.50
Nodes (5): MedVoice App Icon (192px), Blue Circle Container for Microphone, Dark Navy Background with Rounded Corners, Microphone Symbol, Voice Recording Functionality

### Community 8 - "Voice Auto-restart Logic"
Cohesion: 0.50
Nodes (4): Voice Auto-Restart on Silence, Voice Generation Guard (stale result prevention), Voice._processText (callback dispatch), Voice.start

### Community 9 - "Vercel Deployment Config"
Cohesion: 0.50
Nodes (3): orgId, projectId, projectName

### Community 10 - "Vercel Project Docs"
Cohesion: 0.50
Nodes (4): .gitignore (excludes .vercel), project.json (Vercel project config), Vercel Deployment Platform, .vercel Folder Documentation

## Knowledge Gaps
- **59 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `display` (+54 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Voice` connect `Medical UX & Screen Init` to `App Bootstrap & DocGen`, `Voice Dictation Control`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `setActiveField()` connect `Voice Dictation Control` to `UI Rendering & Theming`, `Medical UX & Screen Init`, `Session & Navigation Flow`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `index.html (SPA entry point)` connect `App Bootstrap & DocGen` to `Medical UX & Screen Init`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `startDictation()` (e.g. with `Locked Fields (pre-filled persistent values per template)` and `Draft Resume (continue where you left off)`) actually correct?**
  _`startDictation()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Rendering & Theming` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `App Bootstrap & DocGen` be split into smaller, more focused modules?**
  _Cohesion score 0.11067193675889328 - nodes in this community are weakly interconnected._