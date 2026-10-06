# @serve-tools/signals

Use reactive values, native-shaped collections, and effects through one package.
A computed value tracks what it reads, and an effect runs again when those reads change.

Choose this facade when a module combines core Signals, collections, and effects.
For one capability, choose its [focused owning package](#included-packages) instead.
The facade re-exports the same constructors and functions; it does not create another Signal runtime.

## Try it: keep a task count current

```ts
import { Signal, SignalArray, effect } from "@serve-tools/signals";

const tasks = new SignalArray(["Write the docs"]);
const remaining = new Signal.Computed(() => tasks.length);
const stop = effect(() => console.log(`${remaining.get()} tasks left`));
// Logs "1 tasks left" immediately.

tasks.push("Review the examples");
await new Promise<void>((resolve) => queueMicrotask(resolve));
// Logs "2 tasks left" after the batched effect runs.

stop(); // Releases this effect's subscriptions.
```

Use ordinary collection operations such as `push()`; computed values and effects track the relevant reads.
Effects run synchronously once and batch later invalidations onto a microtask.
Call the returned disposer when its owner is retired; disposing before a queued run cancels that pending run.

## Install

```shell
npm install @serve-tools/signals
```

#### Import from a CDN

```js
import * as signals from "https://esm.run/@serve-tools/signals";
```

## Included packages

Use the root when one module intentionally combines core Signals, collections, and effects.
Each owning package is also available through a focused subpath:

```ts
import { SignalArray } from "@serve-tools/signals/collections";
import { createEffect, effect } from "@serve-tools/signals/effect";
import { Signal } from "@serve-tools/signals/signal";
```

The root and focused subpaths directly re-export their underlying packages:

| Focused subpath                    | Underlying package                                   |
| ---------------------------------- | ---------------------------------------------------- |
| `@serve-tools/signals/signal`      | [`@serve-tools/signal`](../signal/)                  |
| `@serve-tools/signals/collections` | [`@serve-tools/signal-collections`](../collections/) |
| `@serve-tools/signals/effect`      | [`@serve-tools/signal-effect`](../effect/)           |

The facade does not wrap constructors or create another Signal runtime.
Exports retain their original runtime identity, and all packages share the same compatible `@serve-tools/signal` installation.

Prefer the focused owning package when a module needs only one capability and should keep its dependency surface narrow.
Follow that package's README for detailed runtime, invalidation, scheduling, and lifecycle semantics.

## Compatibility

This package is an ES module for the JavaScript runtimes supported by its underlying Signal packages.
Importing the root evaluates every re-export module; focused subpaths evaluate only the selected capability and its dependencies.
Installing the facade still installs all three owning packages; choose a focused owning package to narrow installation as well.
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
