# @serve-tools/lit-signals

The `@serve-tools/lit-signals` package provides fine-grained TC39 Signal bindings and signal-backed reactive decorators for [Lit](https://lit.dev/).
Atomic updates change one template part without requesting a complete component update.

```ts
import { SignalWatcher } from "@serve-tools/lit-signals";
import { computed, property } from "@serve-tools/lit-signals/decorators";
import { html, LitElement } from "lit";

class SignalCounter extends SignalWatcher(LitElement) {
	@property()
	accessor count = 0;

	@computed
	get doubled() {
		return this.count * 2;
	}

	render() {
		return html`
			<button @click=${() => ++this.count}>Increment</button>
			<p>${this.count} doubled is ${this.doubled}.</p>
		`;
	}
}

customElements.define("signal-counter", SignalCounter);
```

## Install

```shell
npm install @serve-tools/signal @serve-tools/lit-signals lit
```

Lit is a peer dependency.
Applications that import `Signal` directly should also declare `@serve-tools/signal` so package managers can share one compatible installation.

## `watch(signalOrCallback)`

`watch()` accepts a `Signal.State`, a `Signal.Computed`, or a reactive callback.
It renders the signal's value or evaluates the callback in a tracked `Signal.Computed`, then updates only its Lit template part when a dependency changes.
Updates across all `watch()` regions are batched in one shared microtask.
It works in child, attribute, and property expressions supported by Lit directives.

```ts
html`${watch(count)}`;
html`${watch(() => html`<p>${count.get()}</p>`)}`;
```

Reactive callbacks may nest.
Signals read by an inner callback invalidate only the inner `watch()` region, while signals read directly by the outer callback remain outer dependencies.
Conditional signal reads are updated each time a callback reevaluates.

```ts
html`${watch(() => html`
	${user.get().name}
	${watch(() => html`${status.get()}`)}
`)}`;
```

The subscription is removed while the containing part is disconnected and restored when it reconnects.
All signals passed to `watch()` must come from the same compatible `@serve-tools/signal` implementation used by this package.

Use `watch()` when only the bound template part needs to change.
Use `SignalWatcher` when signal changes should rerun the component's complete `render()` method.
Use Lit's normal reactive property and update lifecycle when a change must reflect an attribute or invoke lifecycle callbacks.

## `SignalWatcher(BaseElement)`

`SignalWatcher` is a mixin that tracks signals read directly by a Lit element's `render()` method and requests an update when one changes.
Signal changes use Lit's microtask-batched update scheduler without an intermediate task or per-update computed allocation.
Conditional dependencies update on each render, and subscriptions are removed while the element is disconnected.

Nested `watch()` callbacks retain their fine-grained boundary.
Their signal reads update only the nested directive part and do not rerun the containing element's `render()` method.

```ts
import { SignalWatcher, watch } from "@serve-tools/lit-signals";
import { html, LitElement } from "lit";

class UserStatus extends SignalWatcher(LitElement) {
	render() {
		return html`
			${user.get().name}
			${watch(() => status.get())}
		`;
	}
}
```

## `property(options?)`

Import decorators from `@serve-tools/lit-signals/decorators`.
`property()` is a standard auto-accessor decorator that stores its value in a `Signal.State`.
Reading tracks the signal and assigning invalidates signal consumers.
Atomic signal updates are the default.

```ts
class UserBadge extends LitElement {
	@property()
	accessor displayName = "Guest";
}
```

The options are Lit's [`PropertyDeclaration`](https://lit.dev/docs/components/properties/#property-options), plus `update: "atomic" | "lifecycle"`.
Use `update: "lifecycle"` when assignments must request a complete Lit update, reflect properties to attributes, or run lifecycle callbacks.
Lit options such as `hasChanged` and `useDefault` take effect in lifecycle mode; atomic invalidation uses `Signal.State`'s `Object.is` equality.
The decorator requires standard auto-accessors.

## `computed`

`computed` memoizes a getter with one lazy `Signal.Computed` per class instance.
The computed getter tracks decorated properties and other signals that it reads.

```ts
class Counter extends LitElement {
	@property()
	accessor count = 0;

	@computed
	get doubled() {
		return this.count * 2;
	}
}
```

Reading `this.doubled` returns the computed value.
Use `SignalWatcher` when a Lit template should rerender after reading a computed getter.
Use `watch(() => this.doubled)` when only that template part should update.

## Public API

The package root exports:

- `watch(source)` for fine-grained rendering of a signal or reactive callback.
- `WatchSource<Value>` and `WatchCallback<Value>` for reusable directive inputs.
- `SignalWatcher(BaseElement)` for component-wide render tracking.

The `@serve-tools/lit-signals/decorators` entrypoint exports:

- `property(options?)` for signal-backed standard auto-accessors.
- `computed` for memoized standard getter decorators.
- `defaultAttributeConverter` for Lit-compatible default attribute conversion.
- `SignalPropertyDeclaration`, `PropertyDeclaration`, `AttributeConverter`, and `TypeHint` for decorator configuration.

## Compatibility

The package is an ES module for Lit 3.3 and a compatible `@serve-tools/signal` installation.
The decorators require the current standard decorator proposal and auto-accessor support from the application's compiler and runtime.

## Agent Skill

This package includes `skills/serve-tools-lit-signals/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs the Lit integration suite in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/lit-signals
```

Run the opt-in Chromium benchmarks for directive, mixin, and decorator updates with:

```shell
npm run benchmark --workspace @serve-tools/lit-signals
```

## License

[MIT-0](./LICENSE.md)
