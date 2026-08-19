# @serve-tools/signals

The `@serve-tools/signals` package provides flat access to the compatible Signal runtime, native-shaped reactive collections, and microtask-batched effects.

```ts
import { Signal, SignalArray, effect } from "@serve-tools/signals";

const items = new SignalArray(["first"]);
const count = new Signal.Computed(() => items.length);
const dispose = effect(() => console.log(count.get()));

items.push("second");
dispose();
```

## Install

```shell
npm install @serve-tools/signals
```

## Focused imports

Use the root when one module intentionally combines core Signals, collections, and effects.
Each owning package is also available through a focused subpath:

```ts
import { SignalArray } from "@serve-tools/signals/collections";
import { createEffect, effect } from "@serve-tools/signals/effect";
import { Signal } from "@serve-tools/signals/signal";
```

The root and focused subpaths directly re-export their underlying packages:

| Focused subpath                    | Underlying package                |
| ---------------------------------- | --------------------------------- |
| `@serve-tools/signals/signal`      | `@serve-tools/signal`             |
| `@serve-tools/signals/collections` | `@serve-tools/signal-collections` |
| `@serve-tools/signals/effect`      | `@serve-tools/signal-effect`      |

The facade does not wrap constructors or create another Signal runtime.
Exports retain their original runtime identity, and all packages share the same compatible `@serve-tools/signal` installation.

Prefer the focused owning package when a module needs only one capability and should keep its dependency surface narrow.
Follow that package's README for detailed runtime, invalidation, scheduling, and lifecycle semantics.

## Compatibility

This package is an ES module for the JavaScript runtimes supported by its underlying Signal packages.
Importing the root evaluates every re-export module; focused subpaths let applications load one capability directly.
The package does not modify globals.

## Agent Skill

This package includes `skills/serve-tools-signals/SKILL.md` with version-aligned guidance for choosing the root facade or focused imports.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm test --workspace @serve-tools/signals
```

The root and focused import shapes are compile-checked by [`test/signals.recipes.ts`](./test/signals.recipes.ts).

## License

[MIT-0](./LICENSE.md)
