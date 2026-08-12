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

## Agent Skill

This package includes `skills/serve-tools-signal-effect/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## License

[MIT-0](LICENSE.md) — No attribution required.
