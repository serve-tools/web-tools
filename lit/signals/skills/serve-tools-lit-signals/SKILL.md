---
name: serve-tools-lit-signals
description: Use @serve-tools/lit-signals for fine-grained Lit template updates, signal-backed accessor properties, computed getters, optional Lit lifecycle updates, and attribute reflection.
---

# Use @serve-tools/lit-signals

Pass a `Signal.State`, a `Signal.Computed`, or a zero-argument reactive callback to `watch()` inside a Lit template.
The directive renders the signal's value or tracks signals read by the callback and updates only its template part when a dependency changes.
All invalidated `watch()` regions share one microtask flush.
Callbacks may return Lit templates and may contain nested `watch()` callbacks.
An inner callback's signal reads invalidate only its own region; direct reads remain dependencies of the enclosing callback.
Conditional dependencies are replaced whenever a callback reevaluates.
Use `SignalWatcher(LitElement)` when signals read directly by a component's `render()` method should request a complete Lit update.
It relies directly on Lit's microtask-batched scheduler, does not allocate a new computed per update, and disconnects its subscriptions with the element.
Nested `watch()` callbacks remain fine-grained and do not become dependencies of the component render.
Wrap a decorated getter in `watch(() => this.value)` when only that template part should update.

```ts
import { Signal } from "@serve-tools/signal";
import { watch } from "@serve-tools/lit-signals";
import { html } from "lit";

const count = new Signal.State(0);

html`<p>${watch(count)}</p>`;
html`${watch(() => html`
	${count.get()}
	${watch(() => html`${status.get()}`)}
`)}`;

class Counter extends SignalWatcher(LitElement) {
	render() {
		return html`${count.get()}`;
	}
}
```

Import `property` and `computed` from `@serve-tools/lit-signals/decorators`.
Decorate standard auto-accessors with `@property()` and getters with `@computed`.
Properties update their backing `Signal.State` atomically by default without requesting the complete Lit lifecycle.

```ts
class Counter extends LitElement {
	@property()
	accessor count = 0;

	@computed
	get doubled() {
		return this.count * 2;
	}

	render() {
		return html`${this.doubled}`;
	}
}
```

Set `update: "lifecycle"` when property assignments must rerun Lit rendering, reflect properties to attributes, or invoke lifecycle callbacks.
Lit lifecycle options such as `hasChanged` and `useDefault` apply in lifecycle mode.
Attribute-to-property conversion remains available through Lit property metadata.
Signals must come from the compatible `@serve-tools/signal` implementation used by this package.
