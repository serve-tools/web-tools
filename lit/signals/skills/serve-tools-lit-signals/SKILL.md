---
name: serve-tools-lit-signals
description: Use @serve-tools/lit-signals for signal-native templates, cleanup-owning element refs, reactive instance styles, keyed lists, lifecycle-owned effects, signal-backed state, and complete Lit update tracking.
---

# Use @serve-tools/lit-signals

## Choose the update boundary

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

## Decorate state and derived values

Import `collection`, `consume`, `property`, `provide`, `computed`, `effect`, and `style` from `@serve-tools/lit-signals/decorators`.
Decorate standard auto-accessors with `@property()` and getters with `@computed`; properties update their backing `Signal.State` atomically by default without requesting Lit's complete lifecycle.

- Use `@consume({ context, subscribe: true })` for a read-only signal-backed context accessor with an initializer fallback; use `@provide({ context })` for a writable accessor whose replacements notify consumers.
- Keep context values plain rather than providing a `Signal.State`; the accessor backing is the implementation detail that integrates with Signal tracking.
- Context decorators are atomic and excluded from HTML attributes by default; use `update: "lifecycle"` for named Lit changes, and replace values or make their internals reactive when mutations must propagate.
- Import context keys and lower-level lifecycle primitives from `@serve-tools/lit-signals`; call `refreshContexts(host)` from `connectedMoveCallback()` to reannounce providers without interrupting active subscriptions, then re-evaluate consumers after a state-preserving move.
- Subscribing consumers retain misses through the owned document root and re-evaluate provider announcements, takeover, and fallback.
- Use `@collection(SignalArray)`, `@collection(SignalMap)`, `@collection(SignalSet)`, or `@collection(SignalObject)` to convert plain initializers and later assignments to the corresponding signal collection.
- Expect collection accessors to be atomic and excluded from HTML attributes; in-place mutations invalidate signal consumers without creating a named Lit property change.
- Use `SignalWatcher` or callback-form `watch()` around collection reads; the collection itself is not a `Signal.Any` value.
- Set `update: "lifecycle"` when assignments must rerun Lit rendering, reflect properties to attributes, or invoke lifecycle callbacks.
- Use `@computed` to allocate one lazy `Signal.Computed` per instance for a getter.
- Decorate an effect method with `@effect({ phase: "before-update" | "after-update" })`; return a synchronous cleanup when it owns resources.
- Call `updateEffect()` directly for dynamic registration or `manualDispose: true`, and always retain its idempotent disposer in that case.

## Compose fine-grained and component updates

```ts
import { choose, html, repeat, Signal, SignalArray, SignalElement, watch, when } from "@serve-tools/lit-signals";
import { collection, computed, effect, property } from "@serve-tools/lit-signals/decorators";

const count = new Signal.State(0);

class Counter extends SignalElement {
	@property()
	accessor label = "Count";

	@collection(SignalArray)
	accessor values = [1, 2];

	@computed
	get doubled() {
		return count.get() * this.values.length;
	}

	@effect()
	protected reportCount() {
		console.log(this.values.length);
	}

	render() {
		return html`
			${this.label}: ${count}
			${when(
				() => this.values.length > 0,
				() => choose(
					() => this.values.length,
					[[2, () => html`(${watch(() => this.doubled)})`]],
					() => html`Many values`,
				),
			)}
			${repeat(
				() => this.values,
				(value) => value,
				(value) => html`<span>${value}</span>`,
			)}
		`;
	}
}
```

## Apply instance host styles

- Use Lit's re-exported `css` tag for static class styles.
- Decorate a standard auto-accessor with `@style` for one instance-owned constructed sheet containing a reactive `:host` rule.
- Write declaration names in CSS spelling, including kebab-case properties and custom properties.
- Pass static values, direct Signals, or zero-argument reactive callbacks as declaration values; treat `null` and `undefined` as declaration removal.
- Read the accessor as its declarations object; mutate reactive dependencies or replace the entire object because direct declaration-object mutation is not observed.
- Expect whole-object assignment to replace all declarations and sources while preserving the constructed sheet and cascade position.
- Annotate replaceable accessors with `style.Declarations` when assignments need a broader shape than the inferred initializer; use `style.Source` and `style.Value` for individual source and resolved-value annotations.
- Expect style subscriptions to pause after lasting disconnection and refresh on reconnection without rerendering; use `@style` only on `SignalElement` or `SignalWatcher` instances with a shadow render root that supports constructed stylesheets.

## Preserve lifecycle and runtime identity

- Signal-native template bindings, `watch()`, `when()`, `choose()`, `repeat()`, consumed context subscriptions, `SignalElement`, `SignalWatcher`, and `@style` remove subscriptions while their Lit owner is disconnected and restore them on reconnection.
- `repeat()` requires unique stable keys for keyed lists, preserves keyed DOM across moves, and releases removed row dependencies immediately.
- Automatic effects clean up after a lasting disconnection and restart on reconnection; same-task DOM moves do not tear them down.
- A manually disposed effect remains active while disconnected and therefore must always be explicitly disposed.
- Nested reactive directives remain fine-grained and do not become dependencies of their containing directive or component render.
- Import `Signal` and signal collections from `@serve-tools/lit-signals` to use the package's compatible implementations.
- Import event-target Signals from `@serve-tools/lit-signals`, but remember that their eager listeners are not owned by Lit connection lifecycle; dispose them explicitly or pass an external `AbortSignal`.
- Use direct event listeners instead of an event-target Signal when every occurrence or event payload must be processed.
- Keep signal collections shallow and preserve already-normalized collection identity when replacing an accessor value.
- Keep attribute-to-property conversion in Lit property metadata; use `defaultAttributeConverter` only when implementing compatible custom behavior.

## Validate changes

Update directives, callback refs, mixins, decorators, public types, README examples, browser tests, type fixtures, emitted output, and package shape together, covering direct Signal substitutions, ref setup and cleanup, connection waiting, context interoperability and disposal, host styles, reconnection, tracking boundaries, keyed rows, effects, event-target exports, update hooks, source replacement, lifecycle reflection, and standard decorators.
