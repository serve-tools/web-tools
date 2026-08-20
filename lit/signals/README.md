# @serve-tools/lit-signals

The `@serve-tools/lit-signals` package provides fine-grained TC39 Signal bindings and signal-backed reactive decorators for [Lit](https://lit.dev/).
Atomic updates change one template part without requesting a complete component update.

```ts
import { html, SignalElement } from "@serve-tools/lit-signals";
import { computed, property } from "@serve-tools/lit-signals/decorators";

class SignalCounter extends SignalElement {
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
The package root re-exports the compatible `@serve-tools/client-context` runtime used by its context decorators.
`@lit/context` remains structurally interoperable and is not a runtime dependency of this package.
The package root exports signal-native `html` and `svg` tags, Lit's static `css` tag, `SignalElement`, `SignalWatcher`, context primitives, its compatible `Signal` runtime, signal collections, and event-target state utilities.
Applications that import `@serve-tools/signal`, `@serve-tools/signal-collections`, or `@serve-tools/signal-event-target` by their own package names should declare those packages directly.

## Signal-native templates

Import `html` and `svg` from `@serve-tools/lit-signals` instead of `lit`.
A direct `Signal.State` or `Signal.Computed` substitution automatically updates only its Lit template part.
Ordinary Lit substitutions retain their normal behavior.

```ts
import { html, Signal, svg } from "@serve-tools/lit-signals";

const label = new Signal.State("Ready");
const radius = new Signal.State(4);

html`<button title=${label}>${label}</button>`;
html`<svg>${svg`<circle cx="8" cy="8" r=${radius}></circle>`}</svg>`;
```

Automatic binding applies to direct substitutions.
Use `watch(() => expression)` when reactive values must be derived from signal reads, selected conditionally, or nested behind another API.
Callbacks and other ordinary function values remain unchanged, including event listeners.

The root also exports Lit's `css` tag for static class styles that return `CSSResult`.
Use the `@style` decorator for instance-owned reactive host declarations.

## `callbackRef(callback, options?)`

`callbackRef()` creates an element ref for Lit's `ref()` directive and invokes a setup callback whenever the referenced element changes.
The callback may return cleanup, which runs before the element is replaced or unset and when Lit disconnects the directive.

```ts
import { callbackRef, html, SignalElement } from "@serve-tools/lit-signals";
import { ref } from "lit/directives/ref.js";

class ChartElement extends SignalElement {
	readonly canvas = callbackRef<HTMLCanvasElement>((canvas) => {
		const chart = createChart(canvas);

		return () => chart.destroy();
	}, { waitUntilConnected: true });

	protected render() {
		return html`<canvas ${ref(this.canvas)}></canvas>`;
	}
}
```

The returned ref exposes its current element as readonly `.value` and is structurally compatible with Lit's `Ref` type.
Assigning the same element again is a no-op.
By default, setup runs synchronously during Lit rendering and the element may not yet be connected.
Set `waitUntilConnected: true` to defer setup until the current element is connected; replacement or removal cancels pending work.
An element that remains detached continues waiting one animation frame at a time.

## Event-target state

`EventTargetSignal` and `MatchMediaSignal` are re-exported for browser state consumed by `watch()`, `when()`, `choose()`, `SignalElement`, or `SignalWatcher`.

```ts
import { MatchMediaSignal, when } from "@serve-tools/lit-signals";

const dark = new MatchMediaSignal("(prefers-color-scheme: dark)");

html`${when(dark, () => html`Dark mode`, () => html`Light mode`)}`;
```

These observations remain eagerly active while their target listener is installed.
Lit disconnection does not dispose them automatically; call `dispose()` when an observation is permanently retired or pass an external `AbortSignal` for explicit lifetime ownership.
Use direct event listeners when every event occurrence or payload must be processed rather than represented as current state.

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
Use `SignalElement` or `SignalWatcher` when signal changes should rerun the component's Lit update lifecycle.
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

## `@operation(view, options?)`

`operation()` decorates a read-only auto-accessor with values from one ambient `OperationView`.
Each connected element instance owns an independent subscription while the caller that consumes the `AsyncOperationSubscriber` retains ownership of the operation.
The accessor initializer is its value before that element's subscription receives a view value.

```ts
import { AsyncOperation, AsyncOperationSubscriber, html, SignalElement } from "@serve-tools/lit-signals";
import { operation } from "@serve-tools/lit-signals/decorators";

const progress = new AsyncOperationSubscriber<number>();

class ProgressElement extends SignalElement {
	@operation(progress.filter((value) => value > 0).map((value) => `${value}%`))
	accessor progress = "Starting…";

	protected render() {
		return html`<output>${this.progress}</output>`;
	}
}

const startOperation = () =>
	progress.consume(
		new AsyncOperation<number>(async (write) => {
			await write(25);
			await write(50);
		}),
	);
```

Create every filtered or mapped view before calling `consume()` because the subscriber's projection graph becomes immutable once consumption starts.
Element instances may connect, disconnect, and reconnect while consumption is active; each connection subscribes to future values from the already-created view.
Multiple elements may decorate accessors with the same view and update independently.

Disconnection disposes only that element's terminal subscription.
It does not cancel or dispose the ambient subscriber or operation.
The code that calls `consume()` receives the terminal result or error and owns eventual subscriber disposal when cancellation or producer cleanup is required.
A subscriber consumes at most one operation.

Operation views do not replay.
A newly connected element retains its initializer, and a reconnected element retains its last received value, until the view emits again.
Assigning the accessor throws a `TypeError`.

Unsubscription is immediate by default.
Set `disconnectDelay` to a number or a function returning a number to retain the same element subscription across a brief disconnection.
`0` preserves it through a synchronous DOM move if the host reconnects before the timer fires, avoiding missed values during that gap.

Reading the accessor from a `SignalElement` or `SignalWatcher` update participates in the complete Lit update lifecycle.
A plain `LitElement` can instead read it inside `watch(() => this.progress)` for a fine-grained template-part update.

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

## `SignalElement` and `SignalWatcher(BaseElement)`

`SignalElement` precomposes Lit's `LitElement` with complete Signal update tracking.
Use it as the default base class for signal-native Lit components.

```ts
import { html, SignalElement } from "@serve-tools/lit-signals";

class UserStatus extends SignalElement {
	render() {
		return html`${user.get().name}`;
	}
}
```

`SignalWatcher` is a mixin that tracks signals read by a Lit element's complete update lifecycle and requests an update when one changes.
Use the mixin when integrating with a custom `LitElement` subclass or another class hierarchy.
This includes `shouldUpdate()`, `willUpdate()`, `update()`, `render()`, `firstUpdated()`, `updated()`, and reactive controller `hostUpdate()` and `hostUpdated()` hooks.
Signal changes use Lit's microtask-batched update scheduler without an intermediate task or per-update computed allocation.
Conditional dependencies update on each lifecycle run, and subscriptions are removed while the element is disconnected.

Nested `watch()` callbacks retain their fine-grained boundary.
Their signal reads update only the nested directive part and do not rerun the containing element's `render()` method.

```ts
import { html, SignalWatcher, watch } from "@serve-tools/lit-signals";
import { LitElement } from "lit";

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
class ChartElement extends SignalElement {
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

## `@style`

`style` is a standard auto-accessor decorator that creates one constructed stylesheet and one `:host` rule for each element instance.
It accepts static declaration values, direct Signals, and tracked callbacks.
Each reactive declaration updates independently through `CSSStyleDeclaration.setProperty()` without rerendering the element or replacing the whole stylesheet.

```ts
import { css, SignalElement } from "@serve-tools/lit-signals";
import { property, style } from "@serve-tools/lit-signals/decorators";

class ProgressRing extends SignalElement {
	static styles = css`
		:host {
			display: block;
		}
	`;

	@property()
	accessor accent = "royalblue";

	@property()
	accessor size = 20;

	@style
	accessor hostStyle = {
		"--accent": () => this.accent,
		"--size": () => `${this.size}px`,
	};
}
```

Property names use authored CSS spelling, including kebab-case standard properties and `--custom-properties`.
`null` and `undefined` remove a declaration.
Reading the accessor returns its declarations object.
Mutating that object is not observed; update a declaration's nested Signal or callback dependency, or assign a new declarations object instead.
Whole-object assignment replaces every declaration and reactive source while preserving the constructed sheet and its cascade position.
Annotate a replaceable accessor as `style.Declarations` when later assignments need a broader shape than its inferred initializer.
The `style` namespace also provides `style.Source` and `style.Value`; standalone `StyleDeclarations`, `StyleSource`, and `StyleValue` type exports remain available.

The sheet is adopted after Lit creates the instance render root and after the class's static styles, so equal-specificity instance declarations come later in cascade order.
Reactive subscriptions pause after a lasting disconnection and refresh on reconnection.
The decorator requires `SignalElement` or `SignalWatcher` and a shadow render root with constructed stylesheet support.

## `consume(options)` and `provide(options)`

`consume()` and `provide()` are standard auto-accessor decorators that connect plain values to the interoperable Lit context protocol while keeping accessor reads in the Signal graph.
Context values remain ordinary values rather than `Signal.State` instances, so signal-aware and standard context elements interoperate.

```ts
import { createContext, html, SignalElement, watch } from "@serve-tools/lit-signals";
import { consume, provide } from "@serve-tools/lit-signals/decorators";

interface Theme {
	name: string;
}

const themeContext = createContext<Theme>(Symbol("theme"));

class ThemeProvider extends SignalElement {
	@provide({ context: themeContext })
	accessor theme: Theme = { name: "light" };
}

class ThemeConsumer extends SignalElement {
	@consume({ context: themeContext, subscribe: true })
	accessor theme: Theme = { name: "fallback" };

	protected render() {
		return html`${watch(() => this.theme.name)}`;
	}
}
```

A consumed initializer is the fallback until a provider responds.
The provider owns subsequent consumed values, so assigning a consumed accessor throws a `TypeError`.
Set `subscribe: true` to receive later values from the active provider; one-shot consumers still request a fresh value after reconnection.
Subscribing consumers retain an unanswered request at a shared document root, so a provider that connects later can satisfy it.
Provider announcements move subscriptions to newly nearer providers, and provider disconnection gives them a chance to fall back to another ancestor.

Ordinary disconnection and reconnection re-evaluate context automatically.
When `connectedMoveCallback()` preserves element state, call `refreshContexts(this)` from that callback to re-evaluate decorated consumers and reannounce decorated providers without interrupting active subscriptions or adding methods to `Element.prototype`.

```ts
import { refreshContexts } from "@serve-tools/lit-signals/decorators";

connectedMoveCallback() {
	refreshContexts(this);
}
```

Both decorators default to atomic signal invalidation without requesting a complete Lit update.
Set `update: "lifecycle"` to request a named Lit update for the accessor as well.
Context accessors never associate with HTML attributes.

Signal backing is shallow.
Replace the provided value to notify consumers, or provide an object whose internals are independently reactive when in-place mutations must propagate.

## `property(options?)`

Import decorators from `@serve-tools/lit-signals/decorators`.
`property()` is a standard auto-accessor decorator that stores its value in a `Signal.State`.
Reading tracks the signal and assigning invalidates signal consumers.
Atomic signal updates are the default.

```ts
class UserBadge extends SignalElement {
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
class Counter extends SignalElement {
	@property()
	accessor count = 0;

	@computed
	get doubled() {
		return this.count * 2;
	}
}
```

Reading `this.doubled` returns the computed value.
Use `SignalElement` or `SignalWatcher` when a Lit template should rerender after reading a computed getter.
Use `watch(() => this.doubled)` when only that template part should update.

## `effect(options?)`

`effect()` is the standard method-decorator form of `updateEffect()`.
The containing class must apply `SignalWatcher`, and decorated effects are always owned by its connection lifecycle.

```ts
import { effect } from "@serve-tools/lit-signals/decorators";

class ChartElement extends SignalElement {
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
Use `SignalElement` or `SignalWatcher` to rerender the component when collection reads change, or wrap collection reads in `watch()` to update only one template part.

```ts
import { html, SignalArray, SignalElement } from "@serve-tools/lit-signals";
import { collection } from "@serve-tools/lit-signals/decorators";

class TodoList extends SignalElement {
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
- The public `@serve-tools/signal-event-target` API: `EventTargetSignal`, `MatchMediaSignal`, and `EventTargetSignalOptions`.
- `AsyncOperation`, `AsyncOperationSubscriber`, and `OperationView` from the compatible operation runtime.
- Signal-native `html` and `svg` tags that automatically bind direct Signal substitutions.
- Lit's static `css` tag and its `CSSResult` and `CSSResultGroup` types.
- `callbackRef(callback, options?)` for Lit-compatible element refs with setup cleanup and optional connection waiting.
- `callbackRef.Callback`, `callbackRef.Cleanup`, `callbackRef.Options`, and `callbackRef.Result` for callback-ref integrations.
- `when(source, trueCase, falseCase?)` for fine-grained reactive conditional templates.
- `choose(source, cases, defaultCase?)` for fine-grained reactive case selection.
- `repeat(source, key?, renderItem)` for keyed structural reconciliation and independently reactive rows.
- `watch(source)` for fine-grained rendering of a signal or reactive callback.
- `WhenTrueCase`, `WhenFalseCase`, `ChooseCase`, `ChooseDefaultCase`, `RepeatKey`, and `RepeatItem` for reusable directive inputs.
- `ReactiveSource<Value>` and `ReactiveCallback<Value>` for sources shared by all fine-grained directives.
- `WatchSource<Value>` and `WatchCallback<Value>` for reusable directive inputs.
- `SignalElement` as the precomposed signal-watching Lit base class.
- `SignalWatcher(BaseElement)` for applying complete update-lifecycle tracking and host-owned effects to another Lit base class.
- `SignalWatcherApi`, `EffectCallback`, `EffectCleanup`, `EffectOptions`, and `EffectPhase` for effect integrations.

The `@serve-tools/lit-signals/decorators` entrypoint exports:

- `refreshContexts(host)` for non-destructive provider announcements and consumer refreshes after state-preserving moves.
- `collection(Collection)` for atomic, signal-collection-backed standard auto-accessors.
- `consume(options)` for read-only signal-backed context accessors, with optional subscription and named lifecycle updates.
- `property(options?)` for signal-backed standard auto-accessors.
- `provide(options)` for writable signal-backed context accessors that notify protocol consumers.
- `style` for instance-owned reactive `:host` style declarations.
- `computed` for memoized standard getter decorators.
- `effect(options?)` for lifecycle-owned reactive methods.
- `operation(view, options?)` for a connection-owned, read-only accessor over an ambient operation view.
- `defaultAttributeConverter` for Lit-compatible default attribute conversion.
- `CollectionConstructor`, `ConsumeOptions`, `EffectDecoratorOptions`, `OperationOptions`, `ProvideOptions`, `SignalPropertyDeclaration`, `StyleDeclarations`, `StyleSource`, `StyleValue`, `PropertyDeclaration`, `AttributeConverter`, and `TypeHint` for decorator configuration.

## Compatibility

The package is an ES module for Lit 3.3 and re-exports its compatible signal runtime, collections, event-target state utilities, and curated static CSS API.
`@style` requires a shadow render root with constructed stylesheet support.
`@operation` requires a Lit `ReactiveControllerHost`; direct accessor reads require `SignalElement` or `SignalWatcher`, while callback-form fine-grained directives work with plain `LitElement`.
The decorators require the current standard decorator proposal and auto-accessor support from the application's compiler and runtime.

## Agent Skill

This package includes `skills/serve-tools-lit-signals/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Demo

The [hosted demo](https://serve-tools.github.io/web-tools/lit/signals/) provides small runnable examples for direct Signal substitutions, keyed collections, shared operation views, context, and reactive styles.
Each example reveals the exact TypeScript module powering its live preview, so the displayed sample cannot drift from the code being exercised.

[Open the demo directory in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/lit/signals/demo), or run it against the local workspace package:

```shell
npm run build --workspace @serve-tools/lit-signals
npm run dev --workspace @serve-tools/lit-signals-demo
```

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
