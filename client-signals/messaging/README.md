# @serve-tools/signal-messaging

The `@serve-tools/signal-messaging` package provides typed messaging clients and servers together with explicit, read-only subscription Signal state.

```ts
import { Signal } from "@serve-tools/signal";
import { observe } from "@serve-tools/signal-messaging";
import { SharedWorker, type Client } from "@serve-tools/signal-messaging/scope/window";

type CounterProtocol = {
	subscriptions: {
		totals(): number;
	};
};

const worker = new SharedWorker<CounterProtocol>(new URL("./counter-worker.js", import.meta.url), { type: "module" });
const client: Client<CounterProtocol> = worker.client;
const totals = observe(client, "totals");
const totalText = new Signal.Computed(() => {
	const state = totals.get();

	switch (state.status) {
		case "pending":
			return "Waiting for the first total";
		case "ready":
			return `Total: ${state.value}`;
		case "complete":
			return "The worker completed the subscription";
		case "error":
			return `Failed: ${String(state.error)}`;
	}
});

// Bind totalText to a signal-aware UI; it updates as totals changes.

addEventListener(
	"pagehide",
	() => {
		totals.dispose();
		client.close();
		worker.port.close();
	},
	{ once: true },
);
```

Finite requests remain Promise-based.

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-messaging
```

The root re-exports the complete generic `@serve-tools/client-messaging` API.
The `/scope/window` and `/scope/worker` entrypoints likewise combine their client APIs with the compatible Signal package.

## Observation state

`observe()` subscribes eagerly and returns a read-only computed `Observation<Value>`.
Its value is an `ObservationState<Value>`:

```ts
type ObservationState<Value> =
	| { status: "pending" }
	| { status: "ready"; value: Value }
	| { status: "complete" }
	| { status: "error"; error: unknown };
```

`pending` is the initial state.
Each subscription event replaces it with `ready` and the latest value.
Normal remote completion publishes `complete`.
Remote failure, synchronous subscription setup failure, and `AbortSignal` cancellation publish `error`.

Signal consumers may coalesce intermediate ready values.
Use the messaging client's `subscribe()` directly when every occurrence must be processed.

## Typed inputs and options

Declare subscriptions as callable signatures whose first parameter, when present, is their input and whose return type is each emitted value.
A subscription-only protocol may omit `requests` entirely, as `CounterProtocol` does above.
Use the generic messaging `Client<Protocol>` name for connected clients, including clients exposed by worker helpers.

`observe()` derives an input-bearing subscription's `input` from `Parameters<Signature>[0]`.
It derives the observation value from the signature's raw `ReturnType<Signature>` without Promise unwrapping.
Zero-parameter signatures have no input.

Subscriptions with input accept one options object containing a required `input` property:

```ts
const progress = observe(client, "progress", {
	input: { job: "build" },
	signal: controller.signal,
});
```

No-input subscriptions accept an optional object with `signal` and `transfer`:

```ts
const totals = observe(client, "totals", { signal: controller.signal });
```

Using one options shape preserves runtime distinction between an input value and options, including when the declared input includes `undefined`.
Protocol declarations and their inferred observation types exist only at compile time.
They do not change messaging wire behavior.

## Lifecycle

An observation owns exactly one messaging subscription.
Its `active` property reflects whether that subscription can still emit.

Call `dispose()` or use explicit resource management to unsubscribe.
Disposal is idempotent and freezes the current state rather than publishing another state.
Closing the client locally can likewise make an observation inactive without replacing its last state because the messaging client initiated that cancellation.

The observation does not own or close its messaging client, worker, or message port.

## Public API

- The complete `@serve-tools/client-messaging` root and scope APIs are re-exported unchanged.
- `observe(client, name, options?)` eagerly observes one typed messaging subscription.
- `Observation<Value>` describes the read-only computed Signal and its disposal lifecycle.
- `ObservationState<Value>` describes `pending`, `ready`, `complete`, and `error` states.
- `ObserveOptions` describes optional cancellation and input transfer.

## Compatibility

The package is an ES module for runtimes supported by `@serve-tools/client-messaging` and a compatible `@serve-tools/signal` installation.
Browser-specific worker helpers remain isolated in the matching signal package scope entrypoints.
Explicit resource management requires `Symbol.dispose` support or a compatible polyfill; `dispose()` is always available.

## Agent Skill

This package includes `skills/serve-tools-signal-messaging/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs the observation suite in Node.js, Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/signal-messaging
```

Run the opt-in Chromium benchmarks for observation lifecycle and delivery fanout with:

```shell
npm run benchmark --workspace @serve-tools/signal-messaging
```

## License

[MIT-0](./LICENSE.md)
