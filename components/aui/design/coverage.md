# AUI coverage against Base UI 1.7.0

## Scope and evidence

This is a behavior-coverage inventory for a platform-native AUI package, not a claim that AUI reproduces Base UI's React API or implementation architecture.
The baseline is the published [`@base-ui/react` v1.7.0 package](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/package.json) and its [`v1.7.0` source tag](https://github.com/mui/base-ui/tree/v1.7.0/packages/react/src).
The current Base UI `master` branch and canary packages are outside this comparison.

Base UI 1.7.0 publishes 38 component-family entrypoints, including Radio Group, plus utilities and internal entrypoints.
AUI compares observable behavior such as native form ownership, keyboard and pointer interaction, focus, accessibility relationships, geometry, state, and DOM events.
React context, hooks, portals, render props, controlled callback shapes, and Base UI internal entrypoints are not compatibility targets.

The status terms in this document are deliberately narrow:

- **Exported proof** means a public AUI class, contract document, gallery example, and real-browser tests exist for the implemented AUI behavior.
- **Native composition** means AUI deliberately uses authored HTML instead of publishing an empty custom-element wrapper.
- **Provisional** means source, tests, or a design may exist, but final fixes, review, public integration, or proof are still open.
- **Gap** means AUI has no accepted public family for that Base UI behavior.

An exported proof is not full Base UI parity.
Every contract document records behavior that remains native, deliberately differs, or is not implemented.

## Live package inventory

The package surface must be read from `package.json` and `src/aui.ts` together.
At this reconciliation point, the public map contains 36 explicit component and support subpaths: 32 AUI classes for Base UI families, Base, Option, Calendar, and File.
The public barrel and subpaths cover every AUI class used for the 38-family inventory.
Review status remains a separate fact from export presence.

The gallery is a product inventory rather than an export count.
It contains 44 working sections: all 38 Base UI families plus six AUI and Serve Tools extras.
The Base UI roster includes six deliberate native compositions in addition to AUI component classes.
Button, Input, Fieldset, Form, Radio, and Radio Group are real, working compositions built from authored native controls; they are not empty wrappers and do not add six runtime exports.
Base, Time, Context, and Drag/Drop demonstrate the AUI foundation or existing Serve Tools packages and are not Base UI component-parity claims.

The browser directory contains focused suites for every exported family, plus lifecycle, failed-upgrade, selection-adversarial, native-composition, export, and gallery integration suites.
The existence of a test file is not pass evidence; the scoped run and review status below remain authoritative.
The August 28 isolated root checkpoint passed 1,518 of 1,518 browser tests in 114 of 114 files across Chromium, Firefox, and WebKit.
That run includes all 44 gallery sections at 81 of 81 tests and the public export map at 3 of 3 tests.
The durable log is `/Users/jonathan/Documents/Codex/outputs/aui-validation-2026-08-28-final/aui-browser-checkbox-final.log`.
Three 390-pixel mobile-width layout checks pass; the screenshot artifact remains a bounded layout excerpt rather than a visual-regression suite.

## Verified implementation evidence

These are historical source-locked checkpoints, not results for every subsequent worktree change.

| Scope                                        | Exact evidence                                                                                                                                                                                                                                                                                                                      | Boundary                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle foundation                         | 51 focused browser checks passed across Chromium, Firefox, and WebKit.                                                                                                                                                                                                                                                              | Covers the base lifecycle and adversarial failure contract, not every component's resources.                                                                                                                                                                                                                                                                           |
| Frozen full package                          | 1,518 browser tests in 114 files passed across Chromium, Firefox, and WebKit.                                                                                                                                                                                                                                                       | This is the authoritative integrated runtime result; focused checkpoints below remain useful for review scope and must not be added to it.                                                                                                                                                                                                                             |
| Checkbox                                     | 84 standalone Checkbox browser checks passed.                                                                                                                                                                                                                                                                                       | Checkbox Group and assistive-technology evaluation are separate scopes.                                                                                                                                                                                                                                                                                                |
| Accordion and Collapsible                    | 96 focused browser checks passed across the three engines.                                                                                                                                                                                                                                                                          | Exit transitions, `keepMounted`, `hiddenUntilFound`, transition status, and panel-size variables remain gaps.                                                                                                                                                                                                                                                          |
| Avatar, Meter, Progress, Separator           | 78 focused browser checks passed across the three engines.                                                                                                                                                                                                                                                                          | Manual assistive-technology evaluation remains open.                                                                                                                                                                                                                                                                                                                   |
| Checkbox, Switch, Checkbox Group             | The coordinated binary-control checkpoint passed its focused three-engine suite and independent review.                                                                                                                                                                                                                             | This is a scoped behavior proof, not interchangeable native-checkbox behavior or full Base UI API parity.                                                                                                                                                                                                                                                              |
| Toggle and Toggle Group                      | The native-button interaction, ownership, failed-upgrade, and group transaction suites passed and were independently reviewed.                                                                                                                                                                                                      | Form-associated toggles, required selection, and Base UI React rendering APIs are not implemented.                                                                                                                                                                                                                                                                     |
| Popover, Tooltip, Preview Card, Alert Dialog | 120 focused browser checks passed across the three engines and independent review completed.                                                                                                                                                                                                                                        | Native close reasons, transitions, touch behavior, and manual assistive-technology evaluation retain documented limits.                                                                                                                                                                                                                                                |
| Field                                        | The final focused `field.test.ts` run passed 54 checks across the three engines, including the bounded input-adapter and connection-epoch regressions.                                                                                                                                                                              | Field coordinates relationships and presentation; the participating native or form-associated control remains the form and validity owner.                                                                                                                                                                                                                             |
| Autocomplete, Combobox, Select               | 183 focused selection and adversarial checks passed across the three engines; independent source review completed without a remaining defect.                                                                                                                                                                                       | Inline completion, grid navigation, virtualization, generic object values, chips, portal positioning, transition status, and automatic selected-label rendering are gaps.                                                                                                                                                                                              |
| Number Field, OTP Field, Slider              | Independent adversarial review completed without a remaining defect. A combined 156-check three-engine checkpoint passed before the last disjoint fixes; the final Number Field rerun passed 69 checks and the final Slider rerun passed 51 checks across the three engines. OTP Field was unchanged after the combined checkpoint. | These counts are sequential scoped checkpoints and must not be added. Locale formatting, scrubbing, synthetic autofill proof, readonly range behavior, track drag, and a portable shared multi-thumb track remain gaps.                                                                                                                                                |
| Accessibility-tree fixture                   | The source-locked August 28 gallery capture passed 80 checks across 15 Chromium native accessibility-tree snapshots with zero page or console errors; a separate earlier eight-family fixture passed 31 checks.                                                                                                                     | The external captures prove the recorded fixture roles, names, descriptions, and states only for their recorded source closures. DOM-based role locators do not expose `ElementInternals` semantics in the current test stack. The package suite does not prove manual screen-reader behavior or cross-browser accessibility-tree equivalence. See `accessibility.md`. |
| Menus and Toolbar                            | The author and independent reviewer each passed the exact five-family suite at 213 checks across Chromium, Firefox, and WebKit, including the repaired trusted long-page click case. Static review is clear and source is frozen.                                                                                                   | Advanced geometry and transition differences remain documented product gaps; the authoritative integrated suite also passes.                                                                                                                                                                                                                                           |
| Drawer, Toast Region, Scroll Area            | Source is frozen, independent lifecycle review is clear, and the final scoped suite passed 75 checks across the three engines: Drawer 21, Toast Region 30, and Scroll Area 24.                                                                                                                                                      | Mutation-observer-time external part replacement cleanup differs from synchronous stale-work rejection and synchronous disconnection. Direct native close ordering also differs from an accepted gesture proposal that preserves newer writes. The design contract records both.                                                                                       |
| Calendar and File                            | The final owned suite passed 57 checks across the three engines, the independent adversarial suite passed 84, and the final spoofed-Blob brand suite passed 3.                                                                                                                                                                      | Independent review completed with no remaining known runtime gap. These are AUI extras outside the Base UI roster.                                                                                                                                                                                                                                                     |

The final gallery accessibility capture and source hashes are recorded in `/Users/jonathan/Documents/Codex/outputs/aui-gallery-ax-2026-08-28/REPORT.md`.
The separate earlier fixture and reproducible production bundle remain in `/Users/jonathan/Documents/Codex/outputs/aui-validation-2026-08-28/REPORT.md`.
The final source SHA-256 is `e1fdd8ef04edf6b41f39e560264b1da6c2702b3790afce8d45986fcce4a31f5c` and the dist-JavaScript SHA-256 is `b06dee91d307ddae89e2e16fb1dcf74db1e6021a4c23f321b6b4dbd0c4ea0ecd`.
Chromium CDP returned empty `valuetext` for AUI, native, and explicit-ARIA Meter and Progress fixtures alike, so this serialization does not justify a component-specific ARIA workaround.
The final five-pair retention experiment exercised all 36 public constructors and required activation paths.
All 20 predeclared checks passed: exact cleanup, positive-control sensitivity, and post-GC normal criteria are separately recorded in [retention.md](retention.md).
Every normal run ended with zero added DOM nodes, CDP listeners, and documents; this remains a bounded fixture result rather than universal leak proof.

The full repository verification gate passed against the final runtime source, including all browser shards, package checks, typechecks, and Skill checks.
Its durable log is `/Users/jonathan/Documents/Codex/outputs/aui-validation-2026-08-28-final/verify-checkbox-final.log`.
An earlier unchanged-source run had one transient Firefox vertical-Menubar RTL assertion failure; the focused rerun and subsequent full suites passed.
Its cause is not established, and the failed log remains alongside the successful captures.

## Component-family matrix

### Form primitives and simple controls

| Family         | AUI architecture                                                                        | Current status     | Material parity boundary                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Button         | Authored native `button`.                                                               | Native composition | No replacement class or React `useButton` API.                                                                                                  |
| Checkbox       | Form-associated custom control with explicit proposal and native-form semantics.        | Exported proof     | Interaction follows the accepted AUI transaction contract rather than claiming native preactivation identity.                                   |
| Checkbox Group | Coordinator for direct Checkbox members; members remain form owners.                    | Exported proof     | No aggregate group form entry.                                                                                                                  |
| Field          | Structural coordinator around one native or form-associated control.                    | Exported proof     | No validation modes, async validation, form registry, composite field, or array aggregation.                                                    |
| Fieldset       | Authored native `fieldset` and `legend`.                                                | Native composition | No provider wrapper.                                                                                                                            |
| Form           | Authored native `form`.                                                                 | Native composition | No React form context or synthetic submit/reset layer.                                                                                          |
| Input          | Authored native `input`.                                                                | Native composition | Native editing, composition, autocomplete, selection, and validity remain authoritative.                                                        |
| Meter          | Passive host semantic with a presentational native numeric oracle.                      | Exported proof     | No duplicate accessibility identity; manual assistive-technology proof remains open.                                                            |
| Number Field   | Direct native number input plus authored decrement and increment buttons.               | Exported proof     | No locale display formatting, scrubbing, wheel policy, Persian-digit normalization, or custom readonly model.                                   |
| OTP Field      | One direct native editor plus optional inert visual segments.                           | Exported proof     | No competing per-cell editors, text redistribution, or synthetic autofill event.                                                                |
| Progress       | Passive determinate or indeterminate semantic host with a presentational native oracle. | Exported proof     | Manual assistive-technology proof remains open.                                                                                                 |
| Radio          | Authored native `input[type=radio]`.                                                    | Native composition | Uses browser grouping and string values rather than Base UI's custom root and controlled object-value model.                                    |
| Radio Group    | Shared native name/form/tree scope, usually inside `fieldset` and `legend`.             | Native composition | Browser arrow and RTL behavior may differ from Base UI's composite policy.                                                                      |
| Separator      | Passive semantic host with horizontal, vertical, or decorative state.                   | Exported proof     | Decorative omission is an ElementInternals default and can be overridden or conflict with author focus/global ARIA.                             |
| Slider         | One or more direct native range inputs with coherent neighboring constraints.           | Exported proof     | Interval mode keeps real independent native tracks; no portable single shared track, readonly range behavior, or track-drag gesture is claimed. |
| Switch         | Form-associated boolean control with switch semantics.                                  | Exported proof     | Does not claim exact native-checkbox interaction identity.                                                                                      |
| Toggle         | Direct authored native button with pressed state.                                       | Exported proof     | No form value or Base UI render-prop API.                                                                                                       |
| Toggle Group   | Direct Toggle collection with single or multiple selection.                             | Exported proof     | No required selection or form serialization.                                                                                                    |

### Disclosure, selection, and composite navigation

| Family          | AUI architecture                                                                       | Current status | Material parity boundary                                                                             |
| --------------- | -------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| Accordion       | Direct Collapsible collection with retained authored headings and panels.              | Exported proof | No Base UI exit-transition, `keepMounted`, `hiddenUntilFound`, or geometry-variable contract.        |
| Collapsible     | Retained authored heading button and panel.                                            | Exported proof | Closing hides immediately after the accepted transaction.                                            |
| Autocomplete    | Native text input, authored options, and native popover.                               | Exported proof | No inline completion, grids, virtualization, or configurable Base UI filter.                         |
| Combobox        | Native text input, authored options, native popover, and AUI value model.              | Exported proof | No chips, generic object values, grids, virtualization, or React controlled callbacks.               |
| Context Menu    | Direct native buttons and an authored auto popover anchored to invocation coordinates. | Exported proof | Mobile callout interoperability and viewport collision policy remain documented boundaries.          |
| Menu            | Direct native button collection and authored auto popover.                             | Exported proof | Advanced submenu geometry and transitions remain documented gaps.                                    |
| Menubar         | Persistent horizontal collection coordinating menu triggers.                           | Exported proof | AUI uses bounded direct native controls rather than Base UI's React collection architecture.         |
| Navigation Menu | Native links and disclosure triggers with retained authored content.                   | Exported proof | Base UI viewport/arrow geometry and its full transition model remain gaps.                           |
| Select          | Authored button, options, native popover, and form-associated selected-value host.     | Exported proof | No generic object values, virtualization, portal positioning, or automatic selected-label rendering. |
| Tabs            | Authored tab buttons and stable panels.                                                | Exported proof | AUI exposes a natural DOM API rather than Base UI controlled callbacks and render parts.             |
| Toolbar         | Direct native controls with bounded collection navigation.                             | Exported proof | Nested composites retain their own focus ownership rather than being flattened by Toolbar.           |

### Floating, modal, and transient layers

| Family       | AUI architecture                                                                | Current status | Material parity boundary                                                                                                         |
| ------------ | ------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Alert Dialog | Authored native modal dialog with AUI naming and opening guardrails.            | Exported proof | Native focus, isolation, Escape, return value, and form-method behavior remain authoritative.                                    |
| Dialog       | Authored native dialog.                                                         | Exported proof | No React portal or controlled reason vocabulary.                                                                                 |
| Drawer       | Authored native dialog with bounded edge-handle gestures.                       | Exported proof | Content drag, general track gestures, and Base UI's full transition surface are not claimed.                                     |
| Popover      | Authored native popover and CSS positioning.                                    | Exported proof | Native open/close behavior and its available reasons remain authoritative.                                                       |
| Preview Card | Authored link and native auto popover with focus and pointer occupancy delays.  | Exported proof | No sampled pointer trajectory or React transition state.                                                                         |
| Tooltip      | Authored trigger and native popover with description ownership and delay.       | Exported proof | Native `CloseWatcher` grouping may close multiple related layers; touch and manual assistive-technology coverage remain bounded. |
| Toast        | Author-owned toasts coordinated by a region with timing and live-region intent. | Exported proof | Actual speech and identical-message repetition remain manual assistive-technology boundaries.                                    |

### Display, media, and scrolling

| Family      | AUI architecture                                                             | Current status | Material parity boundary                                                                                  |
| ----------- | ---------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| Avatar      | Native image loading oracle with retained authored fallback.                 | Exported proof | No layout-shift guarantee; manual assistive-technology proof remains open.                                |
| Scroll Area | Native overflow viewport with optional author-controlled visual affordances. | Exported proof | Native wheel, touch, keyboard, momentum, focus, overscroll, selection, and snapping remain authoritative. |

## Utilities and AUI extras

| Surface                    | Treatment                                                                                                            | Status                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| CSP Provider               | Prefer CSP-safe authored styles and native composition; no provider class is currently justified.                    | Gap, not a release parity claim              |
| Direction Provider         | Prefer inherited `dir`; component contracts define the narrow cases that must copy direction into top-layer content. | Gap, not a release parity claim              |
| `mergeProps`               | React-specific utility with no planned public AUI equivalent.                                                        | Out of scope                                 |
| `useRender`                | React-specific utility replaced by authored light DOM, slots, parts, attributes, properties, and events.             | Out of scope                                 |
| `types` entrypoint         | AUI publishes types through each explicit JavaScript export rather than a compatibility types barrel.                | Intentional difference                       |
| `unstable-use-media-query` | Use CSS media queries or a separately justified DOM API.                                                             | Out of scope                                 |
| Base and Option            | Public AUI support classes for component authors and selection families.                                             | Supporting exports, not Base UI family count |
| Calendar and File          | AUI-specific components outside the Base UI 1.7.0 family list.                                                       | Exported, reviewed AUI extras                |
| Time, Context, Drag/Drop   | Existing Serve Tools/native integrations demonstrated by the gallery.                                                | Package-adjacent, not AUI family parity      |

## Provenance and licensing

The file-level [implementation provenance ledger](provenance.md) records author attestations for every runtime family, test family, and integration scope.
It also records a bounded whole-corpus similarity audit for the four historical foundation files whose authoring-turn attestation was not retained.
No Base UI or donor source or test was reported as copied or substantially adapted, and the foundation audit found no copied textual block at its declared thresholds.

The donor and AUI packages declare MIT-0.
Base UI 1.7.0 is MIT and requires its copyright and permission notice for copies or substantial portions, but the current ledger contains no adaptation to which that notice condition attaches.
No unrelated Base UI notice is added.
Future adaptations must update the ledger and preserve the applicable notice before release.

## Release interpretation

Family coverage means every Base UI family has either an AUI implementation path, a deliberate native composition, or an explicit gap.
It does not mean full behavioral parity.
The AUI typecheck, publint, ESM package analysis, and Skill checks passed for the frozen August 28 36-subpath public-map checkpoint.
Current release readiness must be established against the active public map, including later entrypoints, rather than inferred from that checkpoint.
The checkpoint's automated accessibility, retention, and repository checks passed within their stated scopes.
Mount performance has not met the fixed acceptance bound, and the manual assistive-technology evaluation in [accessibility.md](accessibility.md) remains open.
These are release holds in addition to the user's explicit hold on pushing or releasing.

The matched Checkbox comparison and application-bundle measurements are recorded in [performance.md](performance.md).
Its completed-update results do not establish an overall advantage: both mount workloads fail to establish the required regression bound.
The unmeasured interaction and multi-component workloads remain separate work, and the documented behavior gaps are not full Base UI parity.
The automated accessibility evidence must not be described as screen-reader certification, and the August 28 accessibility-tree captures must not be described as current after the recorded source closure changes.

Reference sources are Base UI's [`v1.7.0` package map](https://github.com/mui/base-ui/blob/v1.7.0/packages/react/package.json), [`v1.7.0` source](https://github.com/mui/base-ui/tree/v1.7.0/packages/react/src), [accessibility guidance](https://base-ui.com/react/overview/accessibility), [forms handbook](https://base-ui.com/react/handbook/forms), and [MIT license](https://github.com/mui/base-ui/blob/v1.7.0/LICENSE).
