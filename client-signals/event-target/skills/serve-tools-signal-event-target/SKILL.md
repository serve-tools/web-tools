---
name: serve-tools-signal-event-target
description: Use @serve-tools/signal-event-target to observe durable EventTarget state or media-query matches as read-only Signals. Covers refresh, equality, cancellation, and disposal; not event queues or payload processing.
---

# Use @serve-tools/signal-event-target

## Observe current platform state

1. Use `EventTargetSignal(target, type, read, options?)` when an event means durable current state may have changed.
2. Make `read` synchronously return the latest state from the target or related platform object.
3. Read the returned signal with `get()` and derive further state with `Signal.Computed`.
4. Use `MatchMediaSignal(query, options?)` for `matchMedia()` state instead of constructing the generic adapter yourself.

## Keep events and state distinct

- Treat the signal as current state, not an occurrence log.
  Equal values do not invalidate dependents, and Signal consumers may coalesce intermediate changes.
- Use `addEventListener()` directly when every event or its payload must be processed.
- Do not try to call `set()`.
  Event-target-backed signals are read-only computed façades over source-owned state.
- Use `refresh()` only to reconcile state that may have changed without the configured event.

## Preserve ownership

- Call `dispose()` or `Symbol.dispose` when observation is permanently retired.
  Disposal is terminal and idempotent, removes only that instance's listener, and freezes its last value.
- Check `active` when behavior depends on whether future refreshes remain possible.
- Pass an external `AbortSignal` for cancellation or intentional grouped teardown.
  The observation does not own or abort the caller's controller.
- Expect an already-aborted option to allow the initial read but skip listener registration.

## Configure equality deliberately

- Rely on `Object.is` for ordinary scalar state.
- Supply `equals` only when a stable semantic comparison is cheaper or more accurate than object identity.
- Keep equality pure and consistent for every value returned by `read`.

## Validate changes

Update runtime behavior, declarations, README, Node tests, browser tests, type fixtures, benchmark coverage, and package shape together.
Test independent listeners, external cancellation, terminal disposal, refresh behavior, equality, and real `MediaQueryList` compatibility.
