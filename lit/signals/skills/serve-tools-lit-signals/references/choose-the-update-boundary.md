# Choose the update boundary

- Import signal-native `html` and `svg` from `@serve-tools/lit-signals`; pass a `Signal.State` or `Signal.Computed` directly when one template part should track it.
- Pass a `Signal.State`, `Signal.Computed`, or zero-argument reactive callback to `watch()` when only one Lit template part should update.
- Use `when(source, trueCase, falseCase?)` for a signal-aware truthy branch and `choose(source, cases, defaultCase?)` for strict-equality case selection.
- Use `repeat(source, key, renderItem)` for keyed application lists; structural changes reconcile the DOM while each row tracks its own signal reads.
- Pass decorated `@property`, `@computed`, `@collection`, or `@consume` reads to conditionals through a zero-argument callback such as `when(() => this.enabled, ...)`; passing the already-read plain value cannot establish a fine-grained subscription.
- Extend `SignalElement` by default when signals read by Lit update hooks or reactive controller hooks should request a complete Lit update.
- Use `SignalWatcher(BaseElement)` when the same complete update tracking must compose with another Lit base class.
- Use `updateEffect()` or `@effect()` for imperative reactive work with host connection, cleanup, and update-phase ownership.
- Use the re-exported `EventTargetSignal` or `MatchMediaSignal` for durable browser state consumed by Lit reactive boundaries.
- Pass `callbackRef(callback)` to Lit's `ref()` directive for setup that returns cleanup; set `waitUntilConnected: true` only when setup requires `element.isConnected` and may wait by animation frame.
- Use Lit's normal reactive property lifecycle when a change must reflect an attribute or invoke component lifecycle callbacks.

All invalidated `watch()`, `when()`, `choose()`, and `repeat()` regions share one microtask flush.
A direct Signal substitution in signal-native `html` or `svg` is equivalent to a fine-grained `watch(signal)` boundary.
Use callback-form `watch()` for derived, conditional, or nested signal reads; an already-read plain value cannot establish a subscription.
Signals read by an inner callback invalidate only its region, while direct reads remain dependencies of the enclosing callback.
Conditional dependencies are replaced whenever a callback reevaluates.
Only the selected `when()` or `choose()` callback is evaluated and tracked; an omitted false or default callback renders nothing.
