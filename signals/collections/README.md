# @serve-tools/signal-collections

Use familiar arrays, maps, sets, and records while tracking the values your computations actually read.
Mutation updates derived values without replacing an entire collection.

```js
import { Signal } from "@serve-tools/signal";
import { SignalArray } from "@serve-tools/signal-collections";

const prices = new SignalArray([12, 8]);
const total = new Signal.Computed(() => prices.reduce((sum, price) => sum + price, 0));

console.log(total.get()); // 20
prices.push(5);
console.log(total.get()); // 25
prices[0] = 10;
console.log(total.get()); // 23
```

Keep native collection operations and let signal consumers update automatically.
Collections are shallow: wrap a nested record separately when changing its properties in place should also notify readers.

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-collections
```

#### Import from a CDN

```js
import * as signalCollections from "https://esm.run/@serve-tools/signal-collections";
```

## Public API

- `SignalArray` tracks direct index and length reads independently from whole-collection reads.
- `SignalMap` tracks key presence, key values, structure, and content iteration separately.
- `SignalSet` tracks membership and collection reads.
- `SignalObject` creates a shallow signal-backed plain record and includes `SignalObject.fromEntries()`.

All constructors preserve native Array, Map, Set, or Object behavior.
Unchanged writes do not invalidate tracked computations.
The package shares the application's compatible `@serve-tools/signal` installation.

## Lit integration

Install the rendering packages alongside the collections for this integration:

```shell
npm install lit @serve-tools/lit-signals
```

Use `SignalWatcher` or callback-form `watch()` from `@serve-tools/lit-signals` to track ordinary collection reads in Lit templates.
Use the `collection()` decorator when a standard auto-accessor should convert plain initializers and replacements to a particular signal collection.

```ts
import { SignalSet } from "@serve-tools/signal-collections";
import { SignalWatcher } from "@serve-tools/lit-signals";
import { collection } from "@serve-tools/lit-signals/decorators";
import { html, LitElement } from "lit";

class SelectionList extends SignalWatcher(LitElement) {
	@collection(SignalSet)
	accessor selected = new Set<string>();

	render() {
		return html`${this.selected.size} selected`;
	}
}
```

The decorator preserves an assigned `SignalSet` instance and converts an assigned plain `Set` to a new signal-backed collection.
Equivalent behavior applies to `SignalArray`, `SignalMap`, and `SignalObject`.

## Compatibility

The package is an ES module for JavaScript runtimes with `Proxy`, Array, Map, Set, Object, and a compatible `@serve-tools/signal` installation.
It does not modify native prototypes or global constructors.

## Track only the key you need

A `SignalMap` read of one key does not depend on unrelated keys.

```js
import { Signal } from "@serve-tools/signal";
import { SignalMap } from "@serve-tools/signal-collections";

const stock = new SignalMap([["coffee", 3], ["tea", 5]]);
let reads = 0;
const coffee = new Signal.Computed(() => {
	++reads;
	return stock.get("coffee");
});

console.log(coffee.get(), reads); // 3, 1
stock.set("tea", 6);
console.log(coffee.get(), reads); // 3, 1
stock.set("coffee", 2);
console.log(coffee.get(), reads); // 2, 2
```

Use [`@serve-tools/signal`](../signal/) for single replaceable values, these collections for native-shaped mutable data, and [`@serve-tools/lit-signals`](../../lit/signals/) for keyed list rendering and collection decorators.

## Agent Skill

This package includes `skills/serve-tools-signal-collections/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs native collection-compatibility tests in Node.js, Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/signal-collections
```

Run the opt-in collection read, write, and invalidation benchmarks with:

```shell
npm run benchmark --workspace @serve-tools/signal-collections
```

## License

[MIT-0](./LICENSE.md)
