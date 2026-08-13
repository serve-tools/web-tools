---
name: serve-tools-lit-signals
description: Use @serve-tools/lit-signals for fine-grained Lit template updates, signal-backed accessor properties, computed getters, optional Lit lifecycle updates, and attribute reflection.
---

# Use @serve-tools/lit-signals

## Choose the update boundary

- Pass a `Signal.State`, `Signal.Computed`, or zero-argument reactive callback to `watch()` when only one Lit template part should update.
- Use `SignalWatcher(LitElement)` when signals read directly by `render()` should request a complete Lit update.
- Use Lit's normal reactive property lifecycle when a change must reflect an attribute or invoke component lifecycle callbacks.
- Wrap a decorated getter in `watch(() => this.value)` when only that template part should update.

All invalidated `watch()` regions share one microtask flush.
A reactive callback may return a Lit template and may contain nested `watch()` callbacks.
Signals read by an inner callback invalidate only its region, while direct reads remain dependencies of the enclosing callback.
Conditional dependencies are replaced whenever a callback reevaluates.

## Decorate state and derived values

Import `property` and `computed` from `@serve-tools/lit-signals/decorators`.
Decorate standard auto-accessors with `@property()` and getters with `@computed`.
Properties update their backing `Signal.State` atomically by default without requesting Lit's complete update lifecycle.

- Set `update: "lifecycle"` when assignments must rerun Lit rendering, reflect properties to attributes, or invoke lifecycle callbacks.
- Expect Lit options such as `hasChanged` and `useDefault` to apply in lifecycle mode.
- Use `@computed` to allocate one lazy `Signal.Computed` per instance for a getter.

## Compose fine-grained and component updates

```ts
import { Signal } from "@serve-tools/signal";
import { SignalWatcher, watch } from "@serve-tools/lit-signals";
import { computed, property } from "@serve-tools/lit-signals/decorators";
import { html, LitElement } from "lit";

const count = new Signal.State(0);

class Counter extends SignalWatcher(LitElement) {
	@property()
	accessor label = "Count";

	@computed
	get doubled() {
		return count.get() * 2;
	}

	render() {
		return html`${this.label}: ${watch(count)} (${watch(() => this.doubled)})`;
	}
}
```

## Preserve lifecycle and runtime identity

- `watch()` and `SignalWatcher` remove subscriptions while their Lit owner is disconnected and restore them on reconnection.
- Nested `watch()` callbacks remain fine-grained and do not become dependencies of the component render.
- Signals must come from the compatible `@serve-tools/signal` implementation used by this package.
- Keep attribute-to-property conversion in Lit property metadata; use `defaultAttributeConverter` only when implementing compatible custom behavior.

## Validate changes

Update directives, mixins, decorators, public types, README examples, browser tests, type fixtures, emitted output, and package shape together.
Cover disconnection and reconnection, nested tracking boundaries, conditional dependencies, lifecycle-mode reflection, and standard decorator behavior.
