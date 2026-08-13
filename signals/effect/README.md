# @serve-tools/signal-effect

The `@serve-tools/signal-effect` package provides microtask-batched effects for TC39 Signals, built on [`@serve-tools/signal`](../signal/).

```js
import { Signal } from "@serve-tools/signal";
import { effect } from "@serve-tools/signal-effect";

const value = new Signal.State("initial");
const dispose = effect(() => console.log(value.get()));

value.set("updated");

dispose();
```

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-effect
```

Effect depends on `@serve-tools/signal`.
Applications that import Signal directly should also declare it so package managers can share one compatible installation.

Effects run synchronously once, then batch subsequent invalidations onto the next microtask.
`createEffect` provides a dormant controller for consumers that must register disposal before the initial run.

```js
import { createEffect } from "@serve-tools/signal-effect";

const controller = createEffect(() => console.log(value.get()));

addEventListener("pagehide", controller.dispose, { once: true });
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
