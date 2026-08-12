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

To use `signal-polyfill` as the signal implementation, install it under the dependency name using an npm alias:

```shell
npm install @serve-tools/signal@npm:signal-polyfill @serve-tools/signal-collections
```

Continue importing `Signal` from `@serve-tools/signal`; npm resolves that specifier to `signal-polyfill`.

## Exports

- `SignalArray` tracks direct index and length reads independently from whole-collection reads.
- `SignalMap` tracks key presence, key values, structure, and content iteration separately.
- `SignalSet` tracks membership and collection reads.
- `SignalObject` creates a shallow signal-backed plain record and includes `SignalObject.fromEntries()`.

All constructors preserve native Array, Map, Set, or Object behavior.
Unchanged writes do not invalidate tracked computations.
The package shares the application's compatible `@serve-tools/signal` installation.

## Agent Skill

This package includes `skills/serve-tools-signal-collections/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## License

[MIT-0](LICENSE.md) — No attribution required.
