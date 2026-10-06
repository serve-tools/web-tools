# @serve-tools/signal-effect

Run a function now, then run it again whenever the signals it reads change.
Multiple writes in the same turn produce one microtask-batched update.

```js
import { Signal } from "@serve-tools/signal";
import { effect } from "@serve-tools/signal-effect";

const count = new Signal.State(0);
const stop = effect(() => console.log(`Count: ${count.get()}`)); // "Count: 0"

count.set(1);
count.set(2);
await Promise.resolve(); // The scheduled effect logs "Count: 2" once.

stop();
count.set(3); // No further logs.
```

The function declares its dependencies simply by reading them.
Use this for logging or updating an imperative API; use [`Signal DOM`](../../client-signals/dom/) or [`Lit Signals`](../../lit/signals/) for bindings owned by a view.

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalEffect from "https://esm.run/@serve-tools/signal-effect";
```

Effect depends on `@serve-tools/signal`.
Applications that import Signal directly should also declare it so package managers can share one compatible installation.

Effects run synchronously once, then batch subsequent invalidations onto the next microtask.
`createEffect` provides a dormant controller for consumers that must register disposal before the initial run.

```js
import { Signal } from "@serve-tools/signal";
import { createEffect } from "@serve-tools/signal-effect";

const value = new Signal.State("Ready");
const controller = createEffect(() => console.log(value.get()));

addEventListener("pagehide", (event) => {
	if (!event.persisted) controller.dispose();
});
controller.start();
```

Disposal is idempotent and skips an effect that was already pending.
If an initial run throws, its controller disposes itself before rethrowing.
During a batch, later effects still run after an earlier failure; multiple failures are combined in an `AggregateError`.

## Public API

- `effect(run)` executes immediately, tracks the signals read by `run`, and returns an idempotent disposer.
- `createEffect(run)` returns a dormant `Effect` controller with `start()` and `dispose()`.
- `Effect` describes the dormant controller, and `Dispose` describes an effect disposer.

## Compatibility

The package is an ES module for JavaScript runtimes with `queueMicrotask` and a compatible `@serve-tools/signal` installation.
It does not install global APIs.

## Agent Skill

This package includes `skills/serve-tools-signal-effect/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs the scheduler suite in Node.js, Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/signal-effect
```

Run the opt-in scheduler and fanout benchmarks with:

```shell
npm run benchmark --workspace @serve-tools/signal-effect
```

## License

[MIT-0](./LICENSE.md)
