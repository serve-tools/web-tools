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
npm install @serve-tools/lit-signals lit
```

Lit is a peer dependency.
The package root re-exports its compatible `Signal` runtime and signal collections.
Applications that import `@serve-tools/signal` or `@serve-tools/signal-collections` by their own package names should declare those packages directly.

## `watch(signalOrCallback)`

`watch()` accepts a `Signal.State`, a `Signal.Computed`, or a reactive callback.
It renders the signal's value or evaluates the callback in a tracked `Signal.Computed`, then updates only its Lit template part when a dependency changes.
Updates across all `watch()`, `when()`, `choose()`, and `repeat()` regions are batched in one shared microtask.
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
Use `SignalWatcher` when signal changes should rerun the component's Lit update lifecycle.
Use Lit's normal reactive property and update lifecycle when a change must reflect an attribute or invoke lifecycle callbacks.

## `when(source, trueCase, falseCase?)`

`when()` selects one template callback from a reactive condition and updates only its Lit part.
The source must be a `Signal.State`, `Signal.Computed`, or zero-argument reactive callback.
Only the selected callback is evaluated, so signals read by an inactive branch are not dependencies.

```ts
import { when } from "@serve-tools/lit-signals";

html`${when(
	enabled,
	() => html`Enabled`,
	() => html`Disabled`,
)}`;
```

Decorated properties expose their values rather than their backing signals, so read them in a callback:

```ts
html`${when(
	() => this.enabled,
	() => html`${this.items.length} items`,
	() => html`Disabled`,
)}`;
```

Passing `this.enabled` directly is intentionally rejected because the read would occur outside the directive's fine-grained tracking boundary.
When the false callback is omitted, a falsy condition renders nothing.

## `choose(source, cases, defaultCase?)`

`choose()` selects the first reactive template case whose value strictly equals the source value.
Only the selected case is evaluated and tracked.
The optional default callback receives the unmatched source value.

```ts
import { choose } from "@serve-tools/lit-signals";

html`${choose(
	() => this.state.status,
	[
		["idle", () => html`Waiting`],
		["loading", () => html`Loading`],
		["ready", () => html`${this.items.length} items`],
	],
	(status) => html`Unknown status: ${status}`,
)}`;
```

An unmatched value renders nothing when the default callback is omitted.
Nested `watch()`, `when()`, and `choose()` calls retain independent tracking boundaries.

## `repeat(source, key?, renderItem)`

`repeat()` reconciles a reactive iterable with Lit's stable keyed DOM algorithm and gives every rendered row an independent computed signal boundary.
The source must be a signal or zero-argument reactive callback.
Structural collection changes reconcile the list without requesting a complete element render, while signals read by one row update only that row.

```ts
import { repeat } from "@serve-tools/lit-signals";

html`${repeat(
	() => this.items,
	(item) => item.id,
	(item, index) => html`<todo-row .item=${item}>${index}</todo-row>`,
)}`;
```

Provide a key callback for insertions, removals, and moves in application lists.
Keys must be unique and preserve the identity of their logical item.
When the key callback is omitted, the current index is used, matching Lit's unkeyed repeat behavior.

`SignalArray` mutations invalidate the structural source.
`SignalObject` properties or other signals read by `renderItem` become dependencies of only that keyed row.
Removed rows immediately release those subscriptions.
Reconciliation scans the iterable, but performs only the DOM insertions, removals, and moves required by the key change.

## `SignalWatcher(BaseElement)`

`SignalWatcher` is a mixin that tracks signals read by a Lit element's complete update lifecycle and requests an update when one changes.
This includes `shouldUpdate()`, `willUpdate()`, `update()`, `render()`, `firstUpdated()`, `updated()`, and reactive controller `hostUpdate()` and `hostUpdated()` hooks.
Signal changes use Lit's microtask-batched update scheduler without an intermediate task or per-update computed allocation.
Conditional dependencies update on each lifecycle run, and subscriptions are removed while the element is disconnected.

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

## `updateEffect(callback, options?)`

Elements produced by `SignalWatcher` provide `updateEffect()` for imperative reactive work owned by the element lifecycle.
An effect runs once after connection, reruns when a signal it reads changes, and may return cleanup that runs before its next execution, on disposal, or after a lasting disconnection.

```ts
class ChartElement extends SignalWatcher(LitElement) {
	constructor() {
		super();

		this.updateEffect(() => {
			const chart = renderChart(this.canvas, this.data);

			return () => chart.destroy();
		});
	}
}
```

The default `phase: "after-update"` runs after a pending Lit update.
Use `phase: "before-update"` for preparation that must precede it.
When no component update is pending, either phase runs in the package's shared microtask flush without forcing a render.

Effects are cleaned up after disconnection and restarted after reconnection.
A remove-and-reinsert move within the same task does not tear them down.
The returned disposer is idempotent.
Set `manualDispose: true` only for dynamically managed effects that must remain active while disconnected, then retain and call the disposer yourself.

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

## `effect(options?)`

`effect()` is the standard method-decorator form of `updateEffect()`.
The containing class must apply `SignalWatcher`, and decorated effects are always owned by its connection lifecycle.

```ts
import { effect } from "@serve-tools/lit-signals/decorators";

class ChartElement extends SignalWatcher(LitElement) {
	@effect({ phase: "after-update" })
	protected synchronizeChart() {
		const chart = renderChart(this.canvas, this.data);

		return () => chart.destroy();
	}
}
```

Use `updateEffect()` instead when registration is dynamic or manual disposal is required.

## `collection(Collection)`

`collection()` is a standard auto-accessor decorator for native-shaped signal collections such as `SignalArray`, `SignalMap`, `SignalSet`, and `SignalObject` re-exported from `@serve-tools/lit-signals`.
It converts the initializer and later plain collection assignments with the provided constructor.
An assignment that is already an instance of that constructor preserves its identity.

Collection properties are atomic and do not have an associated HTML attribute.
Use `SignalWatcher` to rerender the component when collection reads change, or wrap collection reads in `watch()` to update only one template part.

```ts
import { SignalArray, SignalWatcher } from "@serve-tools/lit-signals";
import { collection } from "@serve-tools/lit-signals/decorators";
import { html, LitElement } from "lit";

class TodoList extends SignalWatcher(LitElement) {
	@collection(SignalArray)
	accessor items = ["First"];

	render() {
		return html`
			<button @click=${() => this.items.push("Next")}>Add</button>
			${this.items.map((item) => html`<p>${item}</p>`)}
		`;
	}
}
```

The collections are shallow.
Wrap nested records or collections separately when their in-place mutations must be reactive.
In-place collection mutations invalidate signal consumers but do not report the accessor name through Lit's `changedProperties` lifecycle map.

## Public API

The package root exports:

- The public `@serve-tools/signal` API, including `Signal`, `AnySignal`, `ComputedSignal`, and `StateSignal`.
- The public `@serve-tools/signal-collections` API: `SignalArray`, `SignalMap`, `SignalObject`, and `SignalSet`.
- `when(source, trueCase, falseCase?)` for fine-grained reactive conditional templates.
- `choose(source, cases, defaultCase?)` for fine-grained reactive case selection.
- `repeat(source, key?, renderItem)` for keyed structural reconciliation and independently reactive rows.
- `watch(source)` for fine-grained rendering of a signal or reactive callback.
- `WhenTrueCase`, `WhenFalseCase`, `ChooseCase`, `ChooseDefaultCase`, `RepeatKey`, and `RepeatItem` for reusable directive inputs.
- `ReactiveSource<Value>` and `ReactiveCallback<Value>` for sources shared by all fine-grained directives.
- `WatchSource<Value>` and `WatchCallback<Value>` for reusable directive inputs.
- `SignalWatcher(BaseElement)` for complete update-lifecycle tracking and host-owned effects.
- `SignalWatcherApi`, `EffectCallback`, `EffectCleanup`, `EffectOptions`, and `EffectPhase` for effect integrations.

The `@serve-tools/lit-signals/decorators` entrypoint exports:

- `collection(Collection)` for atomic, signal-collection-backed standard auto-accessors.
- `property(options?)` for signal-backed standard auto-accessors.
- `computed` for memoized standard getter decorators.
- `effect(options?)` for lifecycle-owned reactive methods.
- `defaultAttributeConverter` for Lit-compatible default attribute conversion.
- `CollectionConstructor`, `EffectDecoratorOptions`, `SignalPropertyDeclaration`, `PropertyDeclaration`, `AttributeConverter`, and `TypeHint` for decorator configuration.

## Compatibility

The package is an ES module for Lit 3.3 and re-exports its compatible signal runtime and collections.
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
