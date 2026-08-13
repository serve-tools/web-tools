---
name: serve-tools-lit-signals
description: Use @serve-tools/lit-signals for fine-grained Lit templates, keyed reactive lists, lifecycle-owned effects, signal-backed properties and collections, computed getters, and complete update-lifecycle tracking.
---

# Use @serve-tools/lit-signals

## Choose the update boundary

- Pass a `Signal.State`, `Signal.Computed`, or zero-argument reactive callback to `watch()` when only one Lit template part should update.
- Use `when(source, trueCase, falseCase?)` for a signal-aware truthy branch and `choose(source, cases, defaultCase?)` for strict-equality case selection.
- Use `repeat(source, key, renderItem)` for keyed application lists; structural changes reconcile the DOM while each row tracks its own signal reads.
- Pass decorated `@property`, `@computed`, or `@collection` reads to conditionals through a zero-argument callback such as `when(() => this.enabled, ...)`; passing the already-read plain value cannot establish a fine-grained subscription.
- Use `SignalWatcher(LitElement)` when signals read by Lit update hooks or reactive controller hooks should request a complete Lit update.
- Use `updateEffect()` or `@effect()` for imperative reactive work with host connection, cleanup, and update-phase ownership.
- Use Lit's normal reactive property lifecycle when a change must reflect an attribute or invoke component lifecycle callbacks.
- Wrap a decorated getter in `watch(() => this.value)` when only that template part should update.

All invalidated `watch()`, `when()`, `choose()`, and `repeat()` regions share one microtask flush.
A reactive callback may return a Lit template and may contain nested `watch()` callbacks.
Signals read by an inner callback invalidate only its region, while direct reads remain dependencies of the enclosing callback.
Conditional dependencies are replaced whenever a callback reevaluates.
Only the selected `when()` or `choose()` callback is evaluated and tracked; an omitted false or default callback renders nothing.

## Decorate state and derived values

Import `collection`, `property`, `computed`, and `effect` from `@serve-tools/lit-signals/decorators`.
Decorate standard auto-accessors with `@property()` and getters with `@computed`.
Properties update their backing `Signal.State` atomically by default without requesting Lit's complete update lifecycle.

- Use `@collection(SignalArray)`, `@collection(SignalMap)`, `@collection(SignalSet)`, or `@collection(SignalObject)` to convert plain initializers and later assignments to the corresponding signal collection.
- Expect collection accessors to be atomic and excluded from HTML attributes; in-place mutations invalidate signal consumers without creating a named Lit property change.
- Use `SignalWatcher` or callback-form `watch()` around collection reads; the collection itself is not a `Signal.Any` value.
- Set `update: "lifecycle"` when assignments must rerun Lit rendering, reflect properties to attributes, or invoke lifecycle callbacks.
- Expect Lit options such as `hasChanged` and `useDefault` to apply in lifecycle mode.
- Use `@computed` to allocate one lazy `Signal.Computed` per instance for a getter.
- Decorate an effect method with `@effect({ phase: "before-update" | "after-update" })`; return a synchronous cleanup when it owns resources.
- Call `updateEffect()` directly for dynamic registration or `manualDispose: true`, and always retain its idempotent disposer in that case.

## Compose fine-grained and component updates

```ts
import { choose, repeat, Signal, SignalArray, SignalWatcher, watch, when } from "@serve-tools/lit-signals";
import { collection, computed, effect, property } from "@serve-tools/lit-signals/decorators";
import { html, LitElement } from "lit";

const count = new Signal.State(0);

class Counter extends SignalWatcher(LitElement) {
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
			${this.label}: ${watch(count)}
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

## Preserve lifecycle and runtime identity

- `watch()`, `when()`, `choose()`, `repeat()`, and `SignalWatcher` remove subscriptions while their Lit owner is disconnected and restore them on reconnection.
- `repeat()` requires unique stable keys for keyed lists, preserves keyed DOM across moves, and releases removed row dependencies immediately.
- Automatic effects clean up after a lasting disconnection and restart on reconnection; same-task DOM moves do not tear them down.
- A manually disposed effect remains active while disconnected and therefore must always be explicitly disposed.
- Nested reactive directives remain fine-grained and do not become dependencies of their containing directive or component render.
- Import `Signal` and signal collections from `@serve-tools/lit-signals` to use the package's compatible implementations.
- Keep signal collections shallow and preserve already-normalized collection identity when replacing an accessor value.
- Keep attribute-to-property conversion in Lit property metadata; use `defaultAttributeConverter` only when implementing compatible custom behavior.

## Validate changes

Update directives, mixins, decorators, public types, README examples, browser tests, type fixtures, emitted output, and package shape together.
Cover disconnection and reconnection, nested tracking boundaries, conditional branch switching, keyed row identity and disposal, effect ordering and cleanup, complete update-hook tracking, source replacement, lifecycle-mode reflection, and standard decorator behavior.
