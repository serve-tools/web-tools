# Transient surfaces and native scrolling

Status: implementation contract.

## Drawer

`DrawerElement` adds handle-only snap gestures around one authored direct native `<dialog>`.
The dialog remains the focus, modality, inertness, Escape, form-method, close, return-value, and top-layer authority.
Drawer forwards native `cancel` and `close` with the same host-level contract as `DialogElement`.

`dialog`, `open`, and `returnValue` expose the current native object and state.
`show()`, `showModal()`, and `close(value?)` delegate to it.
`side` reflects `top`, `right`, `bottom`, or `left` and defaults to `bottom`.
`snapPoints` is a frozen, sorted, unique array of numeric drawer-extent fractions from zero through one and defaults to `[0, 1]`.
`snapPoint` and `snapTo()` synchronously set programmatic presentation without interaction events.

Exactly one direct `[slot="handle"]` child inside the current dialog participates in gestures.
Drawer sets `touch-action: none` only on that handle and restores its prior inline value when ownership ends.
Content never receives a gesture listener, so selection, scrolling, focus, and native input remain unchanged.
Pointer geometry uses the dialog extent captured at gesture start and batches transient CSS writes through one animation frame.
The host exposes `--base-drawer-progress`, `--base-drawer-offset`, and `data-dragging`; author CSS owns positioning, dimensions, transforms, backdrop, and animation.

A completed gesture proposes the nearest projected snap through cancelable, bubbling, composed `beforesnap` and then emits `snapchange` after commit.
A zero snap uses native `dialog.requestClose()`, allowing the native cancel path to veto it.
A native close is never reversed and synchronizes presentation to zero.
For a gesture close, a newer programmatic `snapTo()` written before the queued native `close` event takes precedence over that gesture's zero presentation.
Direct calls on the authored dialog synchronize presentation when its native `close` event arrives, so that event is the commit boundary for direct native closure.
Cancellation, lost capture, handle replacement, disconnection, and adoption restore committed presentation and release capture resources.
Edge-swipe opening, portals, global stacking, CSS-length snap points, and virtual-keyboard repositioning are outside this contract.

## Toast region

`ToastRegionElement` coordinates direct authored `[slot="toast"][id]` nodes without cloning or moving them.
`show(id, { duration, priority })` reveals and restarts exactly one existing node and returns it.
Missing IDs fail with `NotFoundError`; duplicate IDs fail with `InvalidStateError`.
`duration` defaults to 5000 milliseconds, a toast may override it with `data-base-duration`, and zero is persistent.

`dismiss(id, reason)` dispatches cancelable `beforedismiss`, hides the toast if accepted, and dispatches `toastdismiss` with the same immutable toast and reason detail.
A native enabled `[slot="dismiss"]` button inside the toast uses that path.
The region reversibly owns that button's `type="button"` while connected, so accepted or canceled dismissal never submits an ancestor form by accident.
The region does not dispatch form events or create a global toast store.

Each visible toast owns at most one timeout.
The region subtracts elapsed time from the owner document's performance clock and preserves the remainder while pointer or focus is inside, the document is hidden, or the region is disconnected.
Reconnect resumes only current authored toasts, and removal drops retained timer state.

Two stable visually clipped shadow announcers use polite and assertive `aria-live` values.
An explicit show copies the current rendered text to one announcer after clearing it, preserving inline word adjacency while separating block content and omitting hidden, inert, and dismiss-control subtrees.
Visible toast nodes do not receive duplicate live roles.
An authored `aria-live` attribute or standalone implicit live role such as `alert` or `status` remains the sole announcement source, so the shadow announcers skip that toast even when `priority` is supplied.
Multi-token role fallback resolution is outside this DOM-level announcement heuristic.
This creates inspectable announcement intent but does not promise actual speech or reliable repetition of identical text without manual assistive-technology testing.

`focus()` targets the first focusable descendant of the first visible toast, or the toast itself when authors make it focusable.
`f6` opts one local region into an unmodified document F6 shortcut.
An enabled region claims the key only after focus actually moves into one of its visible toasts; an empty or nonfocusable region leaves it available to a later region.
An already prevented key is ignored, so several eligible local regions do not all claim one event.
A provider-level region ordering policy is outside this local component.

## Scroll area

`ScrollAreaElement` measures one direct authored `[slot="viewport"]` and never replaces its native scrolling.
The optional direct `[slot="content"]` inside that viewport supplies resize observation.
Optional direct `[slot="scrollbar-x"]` and `[slot="scrollbar-y"]` rails may contain `[slot="thumb-x"]` and `[slot="thumb-y"]`.

`viewport` returns the current unique viewport.
`scrollTo()` and `scrollBy()` delegate directly to its native methods.
`metrics` is a frozen snapshot containing normalized logical inline and block offsets, maxima, client dimensions, and scroll dimensions for horizontal writing modes.
RTL inline offsets are normalized to zero at logical inline start across the browser scroll-left models.
Vertical writing modes are outside this first contract because they require swapping both rail axes and the browser-specific reversed block direction model as one coherent behavior.

Passive native scroll events and `ResizeObserver` schedule at most one measurement frame.
There is no continuous polling.
The host exposes pixel CSS variables for offsets and maxima plus `overflow-x`, `overflow-y`, `inline-start`, `inline-end`, `block-start`, and `block-end` custom states.
Each rail receives `--base-scroll-thumb-size` and `--base-scroll-thumb-offset`.

Rails are forced to `aria-hidden="true"` while owned because they have no synthetic scrollbar role, value, or keyboard interaction.
Rails containing potentially focusable native content or any authored `tabindex` or `contenteditable` are ignored rather than creating focus targets hidden from accessibility APIs.
Only thumbs receive pointer observation and `touch-action: none`; dragging writes the native viewport offsets.
Wheel, touch, keyboard, focus, overscroll, selection, momentum, and scroll snapping remain native viewport behavior.
Track clicks, virtualization, wheel synthesis, momentum changes, and scroll-linked application effects are outside this contract.

Live identity guards reject stale pointer work synchronously after replacement; replacement reconciliation then releases observers, pointer sessions, presentation attributes, and inline touch-action ownership.
Host disconnection releases them synchronously, and reconnection reacquires them from the new document after adoption.
