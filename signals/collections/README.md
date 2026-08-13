# @serve-tools/signal-collections

The `@serve-tools/signal-collections` package provides Signal-aware native collections built on [`@serve-tools/signal`](../signal/).

```js
import { Signal } from "@serve-tools/signal";
import { SignalArray } from "@serve-tools/signal-collections";

const items = new SignalArray([1, 2]);
const total = new Signal.Computed(() => items.reduce((sum, item) => sum + item, 0));

items.push(3);

console.log(total.get()); // 6
```

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-collections
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
