# @serve-tools/signal

Store a value once and derive everything else from it.
`Signal.Computed` remembers its dependencies and recalculates lazily when you read it after a change.

```js
import { Signal } from "@serve-tools/signal";

const quantity = new Signal.State(2);
const subtotal = new Signal.Computed(() => quantity.get() * 12);
const total = new Signal.Computed(() => subtotal.get() * 1.1);

console.log(total.get().toFixed(2)); // "26.40"
quantity.set(3);
console.log(subtotal.get()); // 36
console.log(total.get().toFixed(2)); // "39.60"
```

Both derived values follow the same source without manually synchronizing them.
Only computations you read are evaluated.
This package implements the exploratory [Stage 1 TC39 Signals proposal](https://github.com/tc39/proposal-signals) without changing globals; the API may evolve with the proposal.

## Install

```shell
npm install @serve-tools/signal
```

#### Import from a CDN

```js
import * as signal from "https://esm.run/@serve-tools/signal";
```

## Features

- Reactive primitives aligned with the current proposal: `State`, `Computed`, and `Watcher`
- Glitch-free execution with topological ordering
- Type guards: `Signal.isState()`, `Signal.isComputed()`, and `Signal.isWatcher()`
- Zero runtime dependencies and no global mutation
- Tested across Node.js, Chromium, Firefox, and WebKit

## React to changes

Use [`@serve-tools/signal-effect`](../effect/) for application effects and [`@serve-tools/signal-dom`](../../client-signals/dom/) or [`@serve-tools/lit-signals`](../../lit/signals/) for reactive UI.
A low-level watcher only schedules work; it does not read your computations for you.

```js
import { Signal } from "@serve-tools/signal";

const count = new Signal.State(0);
const doubled = new Signal.Computed(() => count.get() * 2);
const watcher = new Signal.subtle.Watcher(() => {
	console.log("Signal changed!");
});

watcher.watch(doubled);
doubled.get(); // Evaluate once to establish the dependency on count.
count.set(10); // logs "Signal changed!"

console.log(doubled.get()); // 20; read outside the notification callback.
watcher.watch(); // Rearm notifications after processing pending work.
watcher.unwatch(doubled);
```

Do not read or write signals inside the watcher notification callback.
Queue application work instead, then read the pending computations and rearm the watcher.

## Public API

### `Signal.State<T>`

A writable signal holding a value.

- `new Signal.State(value, options?)` — create with initial value
- `.get()` — read current value
- `.set(value)` — update value

### `Signal.Computed<T>`

A derived signal that recomputes when dependencies change.

- `new Signal.Computed(fn, options?)` — create with computation function
- `.get()` — read computed value (lazy evaluation)

### `Signal.subtle.Watcher`

Low-level primitive for effect scheduling.

- `new Signal.subtle.Watcher(notify)` — create with notification callback
- `.watch(...signals)` — start watching signals
- `.unwatch(...signals)` — stop watching signals
- `.getPending()` — get signals needing recomputation

### Type guards

- `Signal.isState(value)` — returns `true` if value is a `State` signal
- `Signal.isComputed(value)` — returns `true` if value is a `Computed` signal
- `Signal.isWatcher(value)` — returns `true` if value is a `Watcher`

### `Signal.subtle` Utilities

- `untrack(fn)` — run function without tracking dependencies
- `currentComputed()` — get currently computing signal
- `introspectSources(signal)` — get signal's dependencies
- `introspectSinks(signal)` — get signal's dependents
- `hasSources(signal)` — check if signal has dependencies
- `hasSinks(signal)` — check if signal has dependents
- `watched` / `unwatched` — symbols for lifecycle callbacks

The root also exports `AnySignal<T>`, `StateSignal<T>`, and `ComputedSignal<T>` instance aliases.

## Options

Both `State` and `Computed` accept an options object:

```js
const state = new Signal.State(0, {
	equals: (a, b) => a === b, // custom equality (default: Object.is)
	[Signal.subtle.watched]() {
		console.log("now watched");
	},
	[Signal.subtle.unwatched]() {
		console.log("no longer watched");
	},
});
```

## Compatibility

The package is a dependency-free ES module for modern JavaScript runtimes and does not modify the global environment.
Its API follows an exploratory Stage 1 proposal and may evolve with that proposal.

## Agent Skill

This package includes `skills/serve-tools-signal/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs the proposal-behavior suite in Node.js, Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/signal
```

Run the opt-in construction, graph, and invalidation benchmarks with:

```shell
npm run benchmark --workspace @serve-tools/signal
```

## License

[MIT-0](./LICENSE.md)
