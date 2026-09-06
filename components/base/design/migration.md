# Base donor migration inventory

## Scope

This document inventories the Base donor at `/Users/jonathan/GitHub/jsxtools/aui` revision `080ad617486945851d0775278d1c8d215bdf75f7` (`@jsxtools/aui` 0.0.13, 2025-10-13).
It records source capabilities for a future `components/base` package and is not an implementation, compatibility promise, or release plan.
The donor repository remains read-only during this work.

## Design direction

The future API should speak in ordinary custom-element terms: properties express current state, attributes provide markup defaults, platform events report user actions, and methods perform explicit imperative work.
Components should use native `HTMLDialogElement`, Popover, `ElementInternals`, custom states, CSS anchor positioning when applicable, and form-associated custom elements where those primitives fit.
`@serve-tools/signal-dom` should supply the signal-backed DOM, shadow-root, stylesheet, and internals bindings; it should not be hidden behind a second templating language or a React adapter.
The component package should have an explicit element registration API or registration entrypoint, because registration is a side effect and must not be discarded by a tree shaker.
React wrappers are not a design target; a separate adapter can use native custom elements only when it has a real consumer need and declares React as a peer dependency.

## Donor source inventory

| Capability                | Mixins (21)                                                                                                                                              | Element files (20)                                                                                                              | React wrappers (9)                                                                                    | Migration reading                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Element foundations       | `internals`, `children-changed`, `context`                                                                                                               | `internals`, `children-changed`, `context`                                                                                      | `internals`                                                                                           | Preserve explicit ownership, cleanup, and interoperable context, but replace constructor-only observers with connection-scoped resources.                                    |
| Activation and drag/drop  | `click`, `drag`, `drop`                                                                                                                                  | `click`, `drag`, `drop`                                                                                                         | `click`, `drag`, `drop`                                                                               | Preserve keyboard activation and drop-session concepts as small behaviors rather than visible components.                                                                    |
| Files and forms           | `file`, `form-associated`, `form-associated-file`, `form-associated-checkbox`, `form-associated-radio`, `form-associated-choice`, `form-associated-time` | `file`, `form-associated`, `form-associated-file`, `form-associated-checkbox`, `form-associated-choice`, `form-associated-time` | `file`, `form-associated`, `form-associated-file`, `form-associated-checkbox`, `form-associated-time` | Preserve native file selection, validation, and form participation; redesign controls around standard validity, reset, disabled, name, value, and input/change semantics.    |
| Selection and disclosure  | `option`, `toggle`, `toggle-group`, `accordion`                                                                                                          | `option`, `toggle`, `toggle-group`, `accordion`                                                                                 | none                                                                                                  | Preserve the product needs, but model radio, checkbox, listbox, tabs, toggle, and disclosure as separate ARIA patterns with their own keyboard contracts.                    |
| Presentation and feedback | `avatar`, `calendar`, `alert-dialog`, `toast-list`                                                                                                       | `avatar`, `calendar`, `alert-dialog`, `toast-list`                                                                              | none                                                                                                  | Preserve avatar fallback, date selection, modal confirmation, and notification use cases; rebuild the widgets against current native primitives and test them independently. |

The donor contains all 21 mixin files under `/Users/jonathan/GitHub/jsxtools/aui/src/mixins` and all 20 element files under `/Users/jonathan/GitHub/jsxtools/aui/src/elements`.
`form-associated-radio-mixin.ts` has no matching element file, and several element sources are absent from its aggregate barrel.
The nine wrapper files under `/Users/jonathan/GitHub/jsxtools/aui/src/react` are `click`, `drag`, `drop`, `file`, `form-associated`, `form-associated-checkbox`, `form-associated-file`, `form-associated-time`, and `internals`.

## Current public surface

The donor aggregate exports currently expose a narrower and inconsistent set than its source tree.
`src/mixins.ts` exports foundations, drag/drop, file, base form association, time, internals, accordion, avatar, and toast list, but omits alert dialog, calendar, choice, checkbox, radio, option, toggle, and toggle group.
`src/elements.ts` exports alert dialog, avatar, accordion, choice, checkbox, time, option, and toast list, but omits calendar, toggle, and toggle group.
The package export map also names build targets without corresponding source files, including custom-elements, shadow-root, context, alert, option, toast, and capabilities paths.
No future package should reproduce this map before source entrypoints, emitted declarations, package tarball contents, and consumer imports agree.

## Proposed API semantics

| Donor capability          | Preserve                                                                                    | Change or do not copy                                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click and toggle          | Keyboard activation and a cancellable user-intent event.                                    | Do not make generic host elements impersonate buttons by default; use a native button where possible, and expose `pressed` as a boolean property with a matching state attribute only when a toggle is the intended control.                        |
| Drop and file             | File drop, accepted type and maximum-size validation, and a typed file result.              | Use explicit `files`, `accept`, `multiple`, and validation/result properties; dispatch ordinary `input` then `change` when selection changes, and preserve browser picker cancellation as an outcome rather than silently swallowing every failure. |
| Form association          | `name`, `disabled`, `required`, validity, reset, and submission through `ElementInternals`. | Base every control on its native semantics; do not share a checkbox implementation with radio behavior, and do not invent control-specific validity messages before the accessible name and validation contract are defined.                        |
| Options and choice groups | Single versus multiple selection and form serialization.                                    | Specify a concrete pattern per component such as radio group, checkbox group, listbox, or select; use `value`, `selected`, and `selection` only with clear single/multiple rules, roving focus, disabled handling, and change events.               |
| Accordion                 | Grouped disclosures and a programmatic open state.                                          | Use buttons with `aria-expanded` and `aria-controls`, support native focus/keyboard behavior, and make each disclosure's `open` state observable without rebuilding manual slots on every child mutation.                                           |
| Dialog and toast          | Focus restoration, modality, notifications, dismissal, and custom states.                   | Build modal confirmation on `<dialog>` and non-modal messages on Popover or a live region as appropriate; do not rely on unguarded CommandEvent/Popover behavior or mutate global inertness as the primary modal mechanism.                         |
| Calendar and time         | A date grid, keyboard navigation, and time-field form participation.                        | Separate date, time, and date-time contracts; accept locale and calendar data, define bounds and disabled dates, use a complete ARIA grid/date-picker interaction model, and do not hard-code English or `role=application`.                        |
| Avatar                    | Image presentation and fallback content.                                                    | Keep it presentation-only with an explicit `src`, `alt`, loading/error behavior, and slotted fallback; do not treat it as a control.                                                                                                                |

## Donor behavior that will not be copied unchanged

The donor radio mixin gives its host checkbox semantics and toggles it on every click, so it is not a usable radio-control implementation.
The donor calendar hard-codes English labels, declares `role=application`, and implements only arrow-key navigation, so it is a useful use-case reference rather than an accessibility contract.
The donor accordion makes headings clickable slots without button or expanded-state semantics.
The donor React files call `customElements.define()` at module evaluation while the package declares `sideEffects: false`, so registration can be removed by bundling and React is not declared as a runtime peer.
The donor README says it is fully tested with 100% coverage, but the configured coverage excludes most composite families and its CI coverage command selects Chromium only.
The donor child observer has no disconnection cleanup, so it cannot establish the lifecycle policy for a signal DOM base element.

## Runtime dependency mapping

| Future need                      | Existing web-tools package                                 | Role                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Signal state and derived values  | `@serve-tools/signal`                                      | Provide `Signal.State` and `Signal.Computed` for component-owned or supplied reactive state.                                |
| Signal effects and DOM ownership | `@serve-tools/signal-dom` and `@serve-tools/signal-effect` | Render real nodes, bind signal-backed properties/attributes/internals/styles, and dispose bindings with explicit ownership. |
| Component context                | `@serve-tools/client-context`                              | Provide interoperable request/provider events rather than donor-specific context wiring.                                    |
| File picker outcomes             | `@serve-tools/client-interaction`                          | Use its native-file-picker capability and explicit completed, aborted, unavailable, or failed outcomes.                     |
| Drag/drop and pointer sessions   | `@serve-tools/client-input`                                | Use abortable, session-oriented pointer and drop observers rather than long-lived unmanaged listeners.                      |
| Keyboard utilities               | `@serve-tools/client-keyboard`                             | Reuse platform-aware keyboard labels and shortcut semantics when a component exposes shortcuts.                             |

The future base element should compose these packages rather than duplicate their implementations.
Native dialog, popover, form association, custom states, CSS anchor positioning, and `ElementInternals` remain browser APIs that the component package uses directly with feature-appropriate tests.

## Delivery gates

Before migration or release, define one stable public entrypoint map, package each component family with declarations and docs, and test native behavior in Chromium, Firefox, and WebKit where the underlying platform feature is available.
Each component must document its markup, property reflection rules, events, form behavior, accessibility pattern, lifecycle/disposal ownership, browser feature requirements, and registration behavior.
Compatibility with `@jsxtools/aui` is intentionally undecided until consumer imports and supported behaviors have been inventoried.
