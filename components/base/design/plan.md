# Base implementation plan

Status: the August 28 component-family checkpoint was source-frozen and independently reviewed; its browser, automated accessibility, retention, and repository checks passed within their stated scopes.
Current release readiness must be established from the active worktree rather than inferred from that checkpoint.
The September 4 [template migration review](template-migration.md) records current production validation, a corrected Checkbox comparison that satisfies the measured mount gate, and refreshed retention and gallery checks.
The larger bundle exceeds the fixed Base UI incremental target, manual assistive-technology evaluation remains open, and pushing or releasing remains held by the user.

## Outcome and boundaries

Build `@serve-tools/base-components` in `components/base` as an accessible, composable web-component library using the existing Serve Tools signal and DOM packages.
Preserve useful Base capabilities and prefer its natural element, property, method, and event vocabulary over names inherited from React composition.
Use Base UI 1.7.0 as a pinned behavioral reference, not as a required JavaScript API or internal architecture.
Account for the complete donor inventory in [migration.md](migration.md) and the upstream component and behavior inventory in [coverage.md](coverage.md).
Treat complete family coverage as an inventory result, not a statement of full Base UI parity.

Assume native dialog and popover support, ElementInternals, custom CSS states, CSS positioning, and form association.
Tooltip additionally uses native `CloseWatcher`, verified in all three current test engines, to preserve platform close-request grouping without a JavaScript overlay stack.
Do not ship fallback implementations for those capabilities.
Do not infer support for unrelated features, such as state-preserving moves or scoped custom-element registries, from this baseline.

Local commits are authorized.
Pushing, publishing, creating remote releases, and changing registry settings are not authorized.
Keep the donor repository and pre-existing changes in web-tools untouched.

## Architecture

Keep one independently versioned Base workspace with focused component and base-element exports.
Keep imports free of automatic global registration; registration is an explicit application operation.
Keep React adapters out of the core import graph.
Preserve upstream notices if source or tests are adapted.
Maintain the file-level [provenance ledger](provenance.md); every current runtime family has an independence attestation, while the historical foundation has a bounded corpus comparison with its limits stated explicitly.
If future work copies or substantially adapts Base UI material, add its MIT notice and an exact source-to-destination map before release.

Separate three responsibilities:

1. Signal DOM creates nodes and manages individual reactive bindings.
2. The base element owns layout initialization and the lifetime of its own bindings and connection resources.
3. Each component owns interaction semantics, native form integration, public state, accessibility, and its layout.

Use ordinary properties and native input/change events where their semantics fit.
Use cancelable events for proposed actions and document whether they bubble and cross shadow boundaries.
Programmatic assignments do not impersonate user input.
Keep default state, current state, and reflected attributes distinct when the platform distinguishes them.

Select light or shadow DOM per component, with stable styling and composition contracts.
Do not put every component behind an opaque shadow boundary, overwrite authored light-DOM children, or force consumers to use signals.
Prefer native interactive descendants and native dialog behavior where they satisfy the contract.

## Lifecycle requirements

Ordinary removal must release active subscriptions to external stores, connection observers, global listeners, timers, and other connection resources without requiring an application author to call a destructor.
Reconnection must retain the same element, layout nodes, component state, and form state while reconciling bindings to current signal values.
The implementation must not determine destruction through a timeout, finalizer, document-wide mutation scan, or strong global element registry.

These are release requirements, not optional optimizations:

- Initialize layout once after subclass fields exist.
- Run initial binding writes before declaring a connection ready.
- Suspend observation synchronously when a real disconnection is observed.
- Suppress already-queued writes from a suspended binding.
- Resume against current values; do not replay intermediate detached values.
- Keep component-owned state and native form values correct even while detached.
- Own bindings by their creator, not by whichever DOM subtree contains them later.
- Do not suspend or destroy caller-owned slotted content through a subtree walk.
- Include hidden conditional regions and closed shadow content in ownership.
- Give nested Base components independent ownership.
- Do not let one component suspend a stylesheet shared by another connected component.
- Refresh topology-dependent context and document resources on moves or adoption.
- Handle synchronous disconnection, reconnection, and errors during initialization, activation, updates, and cleanup.
- Make permanent disposal idempotent and terminal, but unnecessary for ordinary removal to be collectible.

Compare a retained binding scope with resumable observation against recreating per-binding effects from retained binding descriptions.
Select using retention correctness, reentrancy, hot-path cost, reconnect allocation, simplicity, and effects on existing Signal DOM consumers.
Record the selected state machine and rejected alternatives in `lifecycle.md` before building the component family on it.
Do not replace existing unscoped Signal DOM semantics merely to make Base convenient.

## Acceptance gates

### Gate 1: contract and migration inventory

Pin the donor revision and upstream release.
Account for every existing source capability, export, dependency, and adapter.
Record intentional API changes and any capability that remains deferred; a donor file's existence is not evidence of a correct component.
Establish the workspace, build, type checks, explicit exports, package checks, documentation, and consumer Skill without publishing.
Confirm the licensing path for every copied or substantially adapted source or test file; design citations alone are not a replacement for a required license notice.

### Gate 2: lifecycle and three representative components

Implement and adversarially test binding ownership before completing the base element.
Prove the base with Checkbox, Tabs, and Dialog.

Checkbox must exercise default versus dirty checkedness, indeterminate state, disabled and required behavior, reset, form submission and restoration, native labels, keyboard activation, and user input/change events.
Tabs must exercise stable panels, roving focus, automatic versus manual activation, orientation, RTL, disabled tabs, mutation, and accessible relationships.
Dialog must exercise native modality, initial and return focus, cancellation, nested dialogs, outside interaction policy, form submission, controlled closing, and cleanup after removal.

Run real-browser tests in Chromium, Firefox, and WebKit.
Include creation through both HTML parsing and JavaScript, late upgrade, detach/reconnect, ordinary moves, supported state-preserving moves, shadow composition, hidden content, and adoption into a same-origin document.
Verify synchronous public state and event ordering separately from batched visual updates.

### Gate 3: complete behavior coverage

Build shared behavior only when required by a component: collection navigation, typeahead, form-control behavior, context, and overlay coordination.
Implement families in the dependency order recorded in the coverage matrix.
Each completed family needs runtime implementation, public types, browser tests, documented styling/composition, a working example, and parity evidence.
Keep Base's extra calendar, time, and file capabilities visible in the inventory even though they are outside the Base UI roster.

Button, Input, Fieldset, Form, Radio, and Radio Group deliberately remain authored native HTML compositions.
Their working gallery examples and documented contracts satisfy the Base product decision without adding empty custom-element wrappers.

A matching component name is insufficient for parity.
Check keyboard behavior, focus, forms, nested interaction, RTL, touch, accessibility relationships, and state/transition semantics for each relevant part.
Document intentional platform-native API differences instead of adding React compatibility machinery.
Do not describe full family coverage as full behavior, accessibility, React API, or visual parity.

### Gate 4: evidence and local handoff

Follow [performance.md](performance.md) for matched production comparisons and a retention soak.
Run focused tests, package builds, declaration and tarball checks, Skill checks, and the repository's full `npm run verify` gate.
Inspect the demo in a real browser and complete the [accessibility acceptance procedure](accessibility.md); automated tests do not substitute for a documented screen-reader evaluation.
Report environment failures, unverified assistive-technology combinations, behavior gaps, and inconclusive performance results explicitly.
Reconcile `package.json`, `src/base.ts`, declarations, browser export tests, gallery sections, README examples, and the consumer Skill against the same final public family set.
Commit only scoped, verified work and preserve unrelated user changes.
Stop before any push or release.

## Progress

The table preserves the earlier component-family checkpoint and its original test counts.
The September 4 production migration and refreshed acceptance results are recorded separately in [template-migration.md](template-migration.md), [performance.md](performance.md), and [retention.md).

| Deliverable                               | Status                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Donor inventory and API decisions         | Donor commit `080ad617486945851d0775278d1c8d215bdf75f7` is inventoried in `migration.md`; accepted Base contracts replace rather than promise compatibility with its mixin and React entrypoints.                                                                                                                                                                                 |
| Pinned Base UI behavior matrix            | All 38 Base UI 1.7.0 component-family entrypoints and documented utilities have an exported proof, deliberate native composition, intentional utility difference, or explicit gap in `coverage.md`. This is full inventory coverage, not full parity.                                                                                                                             |
| Lifecycle foundation                      | Implemented; 51 focused checks passed across Chromium, Firefox, and WebKit.                                                                                                                                                                                                                                                                                                       |
| Binary controls                           | Checkbox passed 84 standalone checks. Checkbox Group, Switch, Toggle, and Toggle Group have focused three-engine and independent-review evidence recorded in `coverage.md`.                                                                                                                                                                                                       |
| Disclosure and display                    | Accordion and Collapsible passed 96 focused three-engine checks. Avatar, Meter, Progress, and Separator passed 78. Documented transition and accessibility gaps remain.                                                                                                                                                                                                           |
| Native overlays                           | Popover, Tooltip, Preview Card, and Alert Dialog passed 120 focused three-engine checks and independent review. Dialog remains the native modal foundation.                                                                                                                                                                                                                       |
| Field                                     | The final focused `field.test.ts` run passed 54 checks across the three engines, including the bounded input-adapter and connection-epoch regressions.                                                                                                                                                                                                                            |
| Selection                                 | Autocomplete, Combobox, and Select passed 183 focused selection and adversarial checks across the three engines; independent review found no remaining defect.                                                                                                                                                                                                                    |
| Numeric and code entry                    | Number Field, OTP Field, and Slider completed adversarial review. The final disjoint Number Field and Slider reruns passed 69 and 51 checks respectively across the three engines; `coverage.md` records the preceding combined checkpoint and non-additive count boundary.                                                                                                       |
| Native HTML families                      | Button, Input, Fieldset, Form, Radio, and Radio Group are deliberate, documented, working compositions rather than empty wrappers or public classes.                                                                                                                                                                                                                              |
| Gallery and package-adjacent integrations | The gallery has 44 working sections: all 38 Base UI families plus Base, Calendar, File, Time, Context, and Drag/Drop. The authoritative isolated root run passed all 81 gallery checks and all 3 export checks across the three engines.                                                                                                                                          |
| Menus and Toolbar                         | The author and independent reviewer each passed the exact five-family suite at 213 checks across the three engines, including the repaired trusted long-page click case. Static review is clear and source is frozen.                                                                                                                                                             |
| Drawer, Toast Region, Scroll Area         | Source is frozen and independent review is clear. The final scoped suite passed 75 checks across the three engines: Drawer 21, Toast Region 30, and Scroll Area 24.                                                                                                                                                                                                               |
| Calendar and File extras                  | Public source, design, tests, and gallery examples exist outside the Base UI roster. The final owned suite passed 57 checks, the independent adversarial suite passed 84, and the spoofed-Blob brand suite passed 3 across the three engines; review is clear.                                                                                                                    |
| Accessibility evidence                    | The source-locked August 28 gallery audit passed 80 checks across 15 Chromium accessibility-tree snapshots with zero page or console errors; a separate earlier eight-family fixture passed 31 checks. `accessibility.md` records the in-repository test boundary, unsupported DOM-role-locator diagnostic, and manual acceptance matrix; manual screen-reader work remains open. |
| Matched performance and retention         | The final five-pair retention experiment passes all 20 predeclared checks across 36 public constructors. The ten-pair Checkbox comparison meets its completed-update targets but does not establish the fixed regression bound for either mount workload. All failed and inconclusive earlier experiments remain preserved in `performance.md` and `retention.md`.                |
| Provenance                                | Reconciled in `provenance.md`. Authors attested independent implementation/tests for every current family. The unattested historical foundation has a bounded whole-corpus similarity audit, explicitly not proof of all possible copying. No upstream adaptation was found.                                                                                                      |
| Complete validation                       | The August 28 isolated Base checkpoint passed 1,518 of 1,518 browser tests in 114 files across Chromium, Firefox, and WebKit, including all 81 gallery and 3 export checks. Its complete repository verification gate, typechecks, publint, ESM package analysis, Skill checks, and three mobile-width checks passed. Current-worktree validation is separate.                    |
| Push or release                           | Held by user.                                                                                                                                                                                                                                                                                                                                                                     |

## Release holds

The selected automated evidence is complete, but completion of an experiment is not the same as satisfying its acceptance gate.

1. Resolve the one-Checkbox size shortfall: the current 26,665 raw minified bytes exceed the fixed 14,477-byte Base UI incremental target. The corrected Checkbox latency gate passes; preserve all historical failed, inconclusive, and precision-limited experiments rather than replacing them with the current result.
2. Complete every required row in the manual support matrix and the component checks in `accessibility.md`; identify every untested assistive-technology combination rather than inferring it from automated or adjacent-browser results.
3. Decide which documented behavior gaps and unmeasured workloads are acceptable for the intended release, without calling this full Base UI parity.
4. Obtain the user's authorization before any push or release.

Any further runtime change requires corresponding correctness, ownership, and performance revalidation before relying on these final-source captures.
The local gallery and package inventory are ready for review; the package is not declared release-ready.
