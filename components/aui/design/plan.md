# AUI implementation plan

Status: approved direction; lifecycle foundation, standalone Checkbox, Toggle, and Toggle Group verified; remaining component families are pending.

## Outcome and boundaries

Build `@serve-tools/aui` in `components/aui` as an accessible, composable web-component library using the existing Serve Tools signal and DOM packages.
Preserve useful AUI capabilities and prefer its natural element, property, method, and event vocabulary over names inherited from React composition.
Use Base UI 1.7.0 as a pinned behavioral reference, not as a required JavaScript API or internal architecture.
Account for the complete donor inventory in [migration.md](migration.md) and the upstream component and behavior inventory in [coverage.md](coverage.md).

Assume native dialog and popover support, ElementInternals, custom CSS states, CSS positioning, and form association.
Do not ship fallback implementations for those capabilities.
Do not infer support for unrelated features, such as state-preserving moves or scoped custom-element registries, from this baseline.

Local commits are authorized.
Pushing, publishing, creating remote releases, and changing registry settings are not authorized.
Keep the donor repository and pre-existing changes in web-tools untouched.

## Architecture

Keep one independently versioned AUI workspace with focused component and base-element exports.
Keep imports free of automatic global registration; registration is an explicit application operation.
Keep React adapters out of the core import graph.
Preserve upstream notices if source or tests are adapted.

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
- Give nested AUI components independent ownership.
- Do not let one component suspend a stylesheet shared by another connected component.
- Refresh topology-dependent context and document resources on moves or adoption.
- Handle synchronous disconnection, reconnection, and errors during initialization, activation, updates, and cleanup.
- Make permanent disposal idempotent and terminal, but unnecessary for ordinary removal to be collectible.

Compare a retained binding scope with resumable observation against recreating per-binding effects from retained binding descriptions.
Select using retention correctness, reentrancy, hot-path cost, reconnect allocation, simplicity, and effects on existing Signal DOM consumers.
Record the selected state machine and rejected alternatives in `lifecycle.md` before building the component family on it.
Do not replace existing unscoped Signal DOM semantics merely to make AUI convenient.

## Acceptance gates

### Gate 1: contract and migration inventory

Pin the donor revision and upstream release.
Account for every existing source capability, export, dependency, and adapter.
Record intentional API changes and any capability that remains deferred; a donor file's existence is not evidence of a correct component.
Establish the workspace, build, type checks, explicit exports, package checks, documentation, and consumer Skill without publishing.

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
Keep AUI's extra calendar, time, and file capabilities visible in the inventory even though they are outside the Base UI roster.

A matching component name is insufficient for parity.
Check keyboard behavior, focus, forms, nested interaction, RTL, touch, accessibility relationships, and state/transition semantics for each relevant part.
Document intentional platform-native API differences instead of adding React compatibility machinery.

### Gate 4: evidence and local handoff

Follow [performance.md](performance.md) for matched production comparisons and a retention soak.
Run focused tests, package builds, declaration and tarball checks, Skill checks, and the repository's full `npm run verify` gate.
Inspect the demo in a real browser and perform accessibility checks; automated tests do not substitute for a documented screen-reader evaluation.
Report environment failures, unverified assistive-technology combinations, behavior gaps, and inconclusive performance results explicitly.
Commit only scoped, verified work and preserve unrelated user changes.
Stop before any push or release.

## Progress

| Deliverable                                      | Status                                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Donor inventory and API recommendations          | Inventoried; migration pending                                                                 |
| Pinned Base UI behavior matrix                   | Inventoried against 1.7.0                                                                      |
| Lifecycle decision and adversarial test contract | Implemented; 51 base browser checks pass                                                       |
| AUI workspace and base element                   | Implemented; full repository verification passes                                               |
| Checkbox, Tabs, Dialog                           | Standalone Checkbox verified in 63 browser cases; Tabs and native Dialog proofs pass           |
| Toggle and Toggle Group                          | Implemented; 96 browser cases pass, including ownership and failed-upgrade isolation           |
| Remaining Base UI families and AUI extras        | Pending                                                                                        |
| Matched performance and retention evidence       | DOM regression budget and bounded base/Checkbox retention verified; Base UI comparison pending |
| Complete validation and local commit             | Checkbox/toggle checkpoint passes full repository verification; full component set pending     |
| Push or release                                  | Held by user                                                                                   |
