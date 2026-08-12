# @serve-tools/signal

The `@serve-tools/signal` package implements APIs from the [Stage 1 TC39 Signals proposal](https://github.com/tc39/proposal-signals) without modifying the global environment.

```ts
import { Signal } from "@serve-tools/signal";

const count = new Signal.State(0);
const doubled = new Signal.Computed(() => count.get() * 2);

console.log(count.get()); // 0
console.log(doubled.get()); // 0

count.set(5);

console.log(doubled.get()); // 10
```

Stage 1 proposals remain exploratory, so this package may change as the proposal evolves.

## Install

```shell
npm install @serve-tools/signal
```

## Features

- Reactive primitives aligned with the current proposal: `State`, `Computed`, and `Watcher`
- Glitch-free execution with topological ordering
- Type guards: `Signal.isState()`, `Signal.isComputed()`, and `Signal.isWatcher()`
- Zero dependencies; consumer minifiers reduce it to ~3.1KB, or ~1.3KB gzipped
- Tested across Node.js, Chromium, Firefox, and WebKit

## Watcher

```js
import { Signal } from "@serve-tools/signal";

const count = new Signal.State(0);
const doubled = new Signal.Computed(() => count.get() * 2);

// watch for changes
const watcher = new Signal.subtle.Watcher(() => {
	console.log("Signal changed!");
});

watcher.watch(doubled);

count.set(10); // logs: "Signal changed!"

watcher.unwatch(doubled);
```

## API

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

### Type Guards

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

## Agent Skill

This package includes `skills/serve-tools-signal/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## License

[MIT-0](LICENSE.md) — No attribution required.
