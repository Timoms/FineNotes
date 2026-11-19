# FineNotes X quality audit

19 November 2026. Audit of the current working tree, including pre-existing uncommitted changes. Application code was not changed.

## Executive summary

FineNotes X is an Obsidian notebook plugin for one person's local vault, with optional sync, import, PDF export, audio, and AI. The expected load is a stylus session on a mobile device and notebooks ranging from a few pages to hundreds or about 1,000 pages; there is no multi-user server. The core document format, undo commands, load guard, and extensive pure-logic tests are substantial strengths. The most urgent quality work is at the boundaries: partial import writes, large PDF export memory, error feedback, and the failing release lint gate. The visual language exists, but later CSS overrides and a dense customized More menu make it hard to keep consistent.

**Overall assessment:** Strong functional foundation; uneven integration and release readiness. No critical data-loss defect was reproduced. A partial import failure is a credible high-severity data-integrity risk that needs a failure-injection test before implementation. The desktop UI was inspected in a running Obsidian 1.15.1 vault, but that installed plugin was not proven to match this working tree. No iPad, Android, phone, dark-theme, screen-reader, or physical stylus test was performed.

## Evidence and coverage

| Area                    | Reviewed                                                                                                                                                                       | Limit                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Product and format      | `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `RELEASE.md`, `contracts/api.md`, notebook goldens, package and CI config                                                       | Documentation may describe older UI or a different fork ID.                              |
| Data path               | `src/model/serialize.ts`, `compress.ts`, `src/view/ink-view.ts` save/load, `background-save.ts`, `load-guard.ts`, import adapters and modal, audio recorder, PDF import/export | Sampled the high-risk paths; did not read every converter or every command end to end.   |
| Interaction and display | Toolbar, surface, sidebar, search, notebook settings, dialogs, settings, CSS; live notebook, More menu and notebook-settings modal                                             | One desktop light-theme configuration only; no controlled mobile viewport or stylus.     |
| Supporting systems      | Input, canvas, recognition, search, audio, downloads, scripts, tests and coverage config by inventory and representative source                                                | Did not execute cloud AI, model download, recording, scan, clipboard, or hardware flows. |
| Checks                  | Typecheck, lint, full tests, production build, format check, Obsidian review lint                                                                                              | Build deployed only to `/private/tmp/finenotes-audit-build`, never to the user's vault.  |

The current tree has 355 `src` files and 354 `tests` files. `npm run typecheck`, `npm run lint`, `npm test -- --reporter=dot` (5,596 passed, 9 skipped), and `npm run build` passed. `npm run format:check` failed on seven files. `npm run lint:review` failed with 9 errors and 25 warnings. The full test run also printed welcome-sticker errors because the test's mocked Obsidian `fileManager` is absent; the test still passed. This is a test-harness signal, not evidence that real sticker creation fails.

**Evidence labels:** _Live verified_ means observed in the running desktop UI. _Source verified_ means the cited path and scenario are present in code, but the resulting product symptom was not run. _Risk_ means the adverse outcome depends on platform behavior or timing. No item below should be read as a completed mobile reproduction.

## Data integrity and reliability — must address first

### QA-01 — Partial import leaves files without a notebook

**Category / severity / complexity:** Data integrity and feedback; High; Medium. **Evidence:** Source verified. `ImportNotebookModal.save` creates folders and every attachment before `vault.create(notePath, content)` (`src/view/import-notebook-modal.ts:362-398`). If the final notebook creation fails because storage is full, a filename is taken, or the vault is unavailable, those attachments remain. The direct PDF branch in `run` (`:316-347`) reports the resulting save exception as “It could not be read,” while other converters report “could not be saved.” No modal persistence test exercises failure after the first attachment.

**Impact / recommendation / verification:** Users get stray files and a misleading cause after a failed import. Stage in a uniquely named temporary folder or track only files created by this attempt and remove them after a confirmed failure, without touching pre-existing files. Keep save errors separate from parse errors. Inject failure at each create step in a vault adapter test and assert the original vault and earlier successful imports remain intact.

### QA-02 — PDF export retains every encoded page in memory

**Category / severity / complexity:** Performance and reliability; High; Medium. **Evidence:** Source verified. `src/view/pdf-export.ts:58-86` pushes each rendered JPEG into `out` until the final `buildImagePdf` call. `src/export/pdf-writer.ts:71-139,228-245` then holds those JPEGs in a `ByteSink` and allocates a final combined buffer. The source comment promises one page raster at a time, which applies to canvases but not JPEG bytes. A long image-only notebook is the concrete case; the export tests cover only small page sets.

**Impact / recommendation / verification:** A large export can peak at multiple copies of the complete PDF and be terminated by iPadOS. Write PDF objects incrementally to a bounded sink or another existing vault-compatible streaming path; keep the current PDF format and page ordering. Measure peak memory and export a representative 200-page image notebook on an iPad, plus validate the resulting PDF.

### QA-03 — Concurrent settings saves may finish out of order

**Category / severity / complexity:** Persistence; Medium; Small. **Evidence:** Risk. `GoodObsidianPlugin.saveSettings` directly calls asynchronous `saveData(this.settings)` (`src/main.ts:838-841`), and rapid text changes in `src/settings.ts:2335-2417` and several `void saveSettings()` callers can overlap. The repository has no test where an older write resolves after a newer one. Whether this loses a setting depends on when Obsidian serializes `saveData` and whether its writes are ordered.

**Impact / recommendation / verification:** After fast edits and app close, the last visible setting may not be the one on disk. First reproduce with a delayed `saveData` fake; if confirmed, serialize writes or coalesce pending saves at the plugin boundary and flush on unload. Reopen settings and verify the last value, including rapid toolbar and saved-pen edits.

### QA-04 — Rename failure has no user-facing recovery

**Category / severity / complexity:** User-facing error handling; Medium; Small. **Evidence:** Source verified. The notebook settings name field calls `void this.host.rename(value).then(() => this.render())` in `src/view/note-settings-modal.ts:163-174` without a rejection handler. A destination name already in use or a failed folder rename rejects. The modal is left showing the attempted name, with no error message or reset.

**Impact / recommendation / verification:** Users cannot tell whether a rename took effect, and the rejection can reach the console. Catch the error, restore the current name, and show a concise Obsidian notice. Inject a rejected rename promise in a modal test; verify the field and file name stay aligned.

## Visual design and experience

### QA-05 — The More menu becomes a second full command palette

**Category / severity / complexity:** Navigation and hierarchy; Medium; Medium. **Evidence:** Live verified in the currently installed desktop plugin: the customized More panel displayed 27 actions in a three-column card grid, from page thumbnails through AI and laser pointer. `src/view/toolbar.ts:1595-1707` adds every configured More action and folded action; `styles.css:15512-15578` sets 86 px minimum cards in three columns. The menu nearly filled the height of the 4K app window. Configuration contributes to the count; default layout was not checked.

**Impact / recommendation / verification:** Frequent actions are hard to scan, especially on a phone. Keep toolbar customization, but give More a short stable primary group and compact secondary rows or user-defined groups; do not add another feature layer. Compare the default and a 25-action setup at desktop, tablet, and phone widths, then complete add page, export, and settings journeys by touch and keyboard.

### QA-06 — Late CSS overrides weaken theme and state consistency

**Category / severity / complexity:** Visual consistency and maintainability; Medium; Medium. **Evidence:** Source verified. `styles.css` has 15,785 lines and 78 `!important` declarations. More is first defined as a 44 px list (`:13146-13178`), changed to a compact list (`:14082-14182`), then changed to an 86 px card grid (`:15512-15578`). A broad late hover rule at `:15305-15319` forces glass backgrounds for buttons in the view and dialogs. Other late rules use fixed `#007aff` (`:14138-14145`, `:14914-14917`) rather than the existing `--gob-*` and Obsidian accent tokens (`:22-150`). Theme-specific contrast was not measured.

**Impact / recommendation / verification:** Equivalent controls can inherit different hover, selected, and focus treatments; theme changes need edits in several distant places. Consolidate the final effective rules by component and route semantic colors through the existing tokens. Use a small visual matrix of light, dark, and one non-blue accent theme at desktop and phone widths, including hover, focus, disabled, and selected states.

### QA-07 — Some compact controls miss a 44 × 44 touch target

**Category / severity / complexity:** Accessibility and touch; Medium; Small. **Evidence:** Source verified. The stylesheet declares a 44 px touch token and a 36 px compact token (`styles.css:33-39`), but the page contents fold control is 32 × 44 px (`:1996-2005`), sticker color swatches in the Intelligent Strip are 34 × 34 px (`:15599-15609`), and the foil delete action is 32 × 32 px (`:15406-15420`). These are actionable controls on a touch-capable plugin; no physical target measurement was performed.

**Impact / recommendation / verification:** Finger users can miss controls or hit nearby content. Expand hit boxes to at least 44 px while retaining the visible icon size and layout where possible. Check neighboring targets at phone and iPad widths with touch, then keyboard focus and screen-reader labels.

### QA-08 — Menu and dialog conventions diverge in keyboard and feedback paths

**Category / severity / complexity:** Interaction consistency; Medium; Medium. **Evidence:** Source verified. The custom More panel uses `role="menu"` with grid `menuitem` buttons (`src/view/toolbar.ts:1565-1625`), but only Up and Down move focus (`:1710-1738`), irrespective of its three-column visual layout. Escape returns focus, which is good. The notebook settings rename field does not show an error on rejection (QA-04), whereas PDF import does show a Notice and disables its action while busy (`src/view/pdf-import-modal.ts:62-94`). These are related navigation/feedback rules, not separate feature requests.

**Impact / recommendation / verification:** Keyboard users cannot navigate the visible grid as expected, and errors differ by dialog. Define a short convention for action feedback, busy state, focus return, and arrow behavior; apply it to the current More panel and affected dialogs. Verify with keyboard only and VoiceOver on macOS, then touch on iPad.

## Architecture, tests, and release process

### QA-09 — The main surface and toolbar combine too many jobs

**Category / severity / complexity:** Maintainability and regression risk; Medium; Large. **Evidence:** Source verified. `src/view/ink-surface.ts` is 12,276 lines and manages pointer input, page layout, text editing, selection, cropping, clipboard, rulers, rendering, timers, and keyboard UI. `src/view/toolbar.ts` is 5,517 lines and handles tool state, DOM construction, popovers, custom menu items, and positioning. `src/view/ink-view.ts` is 5,541 lines and handles persistence, search, import, export, AI, and page actions. The repository already has pure helpers and focused submodules; no full rewrite is needed.

**Impact / recommendation / verification:** A small visual or gesture change can alter unrelated lifecycle paths, and human review is difficult. Move one responsibility at a time behind the existing view/model interfaces, starting with the save/import UI boundaries and then one toolbar panel. Preserve event cleanup and error handling; run focused tests and the complete quality gates after each extraction.

### QA-10 — High-risk adapters lack failure and platform tests

**Category / severity / complexity:** Verification; Medium; Medium. **Evidence:** Source verified. `vitest.config.mts` deliberately covers pure modules and selected adapters, while the 12K-line surface, import modal's vault writes, notebook-settings rename path, and full PDF export memory path have no matching integration tests. `tests/view/pdf-export.test.ts` uses a handful of pages. `tests/view/plugin-entry.test.ts` passes while logging missing mocked `fileManager` errors for welcome stickers.

**Impact / recommendation / verification:** CI can be green while vault side effects and mobile resource limits fail. Add a small fake-vault failure suite, a rejected rename test, and one representative end-to-end manual checklist. Repair the welcome-sticker fake so unexpected stderr fails its test. Keep device results recorded with the tested plugin build.

### QA-11 — Release gates currently disagree and fail

**Category / severity / complexity:** Build quality; High; Small. **Evidence:** Source verified by commands in this working tree. `npm run lint` and production build pass, but CI also runs `npm run lint:review` (`.github/workflows/ci.yml:24-38`), which reports 9 errors and 25 warnings, including misused async callbacks in `src/settings.ts`, static style assignments in `src/view/toolbar.ts`, and timer API warnings in popout UI files. `npm run format:check` fails in seven files, though CI currently does not run it. The review rules intentionally live in a separate config.

**Impact / recommendation / verification:** A release candidate cannot pass the declared review gate; style drift remains hidden from CI. Fix the specific lint findings without broad autofix, then make local checks and CI agree on formatting. Rerun both lint commands, format check, tests, typecheck, and production build.

### QA-12 — Fork-specific instructions send contributors to the other plugin ID

**Category / severity / complexity:** Documentation and onboarding; Low; Small. **Evidence:** Source verified. `README.md:148-152` identifies this fork as `finenotes-x`, while `CONTRIBUTING.md:35-43` tells contributors to deploy to `.obsidian/plugins/finenotes`. The plugin ID is intentionally separate so the two can coexist. The contract also starts with older GoodObsidian vocabulary (`contracts/api.md:1-27`), which should be labeled historical rather than treated as current architectural guidance.

**Impact / recommendation / verification:** A contributor can overwrite or test the official plugin and attribute the result to FineNotes X. Correct the deploy path and label historical contract sections, without changing note markers or file format. Follow the documented install steps in a disposable vault.

## Existing design-system foundation

The plugin already has a small design system: `styles.css:22-150` defines touch, radius, color, surface, and motion tokens, and Obsidian `Setting`, `Modal`, `Notice`, and `clickable-icon` conventions appear across the UI. Keep that foundation. A useful one-page guideline would define semantic button states, 44 px touch hit boxes, dialog busy/error/success behavior, menu focus movement, and which Obsidian variables each `--gob-*` token may wrap. Consolidating effective CSS rules is more valuable than adding a component framework.

## Prioritization and limits

**Quick wins:** QA-03, QA-04, QA-07, QA-11, QA-12. **Larger work:** QA-01, QA-02, QA-05, QA-06, QA-08, QA-09, QA-10. See `docs/QUALITY_ROADMAP.md` for coherent batches and acceptance checks.

**Not checked:** physical stylus input, iPad/Android/phone layout, screen-reader behavior, dark and custom themes, long-running recordings, live AI and network calls, real import archives on device, 200-page export memory, console output from the running Obsidian window, and every source file in the 355-file tree. The desktop UI inspection did not write to the vault. Some risk findings require the listed reproduction before they become verified defects.
