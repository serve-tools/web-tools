# @serve-tools/signal-messaging

Call typed operations over a message port and render the latest subscription value as a signal.
This complete browser example uses a `MessageChannel`; the same protocol can cross a worker boundary.

```ts
import { effect } from "@serve-tools/signal-effect";
import { connect, observe, serve } from "@serve-tools/signal-messaging";

type Protocol = {
	requests: { greet(name: string): string };
	subscriptions: { clock(): number };
};
const { port1, port2 } = new MessageChannel();
const server = serve<Protocol>(port1, {
	requests: { greet: (name) => `Hello, ${name}!` },
	subscriptions: {
		clock: (_input, { emit }) => {
			emit(Date.now());
			const timer = setInterval(() => emit(Date.now()), 1_000);
			return () => clearInterval(timer);
		},
	},
});
const client = connect<Protocol>(port2);
const clock = observe(client, "clock");
const output = document.createElement("output");
document.body.append(output);
const stop = effect(() => {
	const state = clock.get();
	output.value = state.status === "ready" ? new Date(state.value).toLocaleTimeString()
		: state.status === "error" ? `Failed: ${String(state.error)}` : state.status;
});

addEventListener("pagehide", () => {
	stop();
	clock.dispose();
	client.close();
	server.close();
	port1.close();
	port2.close();
});
```

The clock output updates every second; canceling the subscription clears the server's timer.
Install `@serve-tools/signal-effect` as well for this rendering recipe.
Finite requests remain Promise-based.

This first example owns one active page connection and retires it on `pagehide`.
Cached-page restoration requires a fresh client and observation; follow the [back/forward-cache reconnection recipe](../../client/messaging/#backforward-cache).

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-messaging @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalMessaging from "https://esm.run/@serve-tools/signal-messaging";
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
A subscription-only protocol may omit `requests` entirely.
For example, this separate message-channel protocol reports progress for a named job:

```ts
import { connect, observe, serve } from "@serve-tools/signal-messaging";

type Jobs = { subscriptions: { progress(input: { job: string }): string } };
const { port1, port2 } = new MessageChannel();
const server = serve<Jobs>(port1, {
	subscriptions: { progress: ({ job }, { emit }) => emit(`${job}: ready`) },
});
const client = connect<Jobs>(port2);
const controller = new AbortController();
const progress = observe(client, "progress", { input: { job: "build" }, signal: controller.signal });

// When this feature is permanently retired:
function disposeJobs() {
	controller.abort();
	progress.dispose();
	client.close();
	server.close();
	port1.close();
	port2.close();
}
```

The observation becomes `{ status: "ready", value: "build: ready" }` after message delivery.
Call `disposeJobs()` when the feature is retired.
`observe()` derives the input from `Parameters<Signature>[0]` and the value from the raw `ReturnType<Signature>` without Promise unwrapping.
Zero-parameter signatures, such as the first example's `clock`, take only an optional cancellation/transfer options object.
Using one options shape preserves the runtime distinction between input values and options, including when the declared input includes `undefined`.
Protocol declarations and their inferred observation types exist only at compile time; they do not validate wire values.

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

## Send a request through the same connection

The server above also handles `greet`.
A one-off request produces a typed Promise while the clock observation keeps streaming:

```ts
void client.request("greet", "Ada").then(console.log, console.error); // "Hello, Ada!"
```

## Choose a messaging layer

Use [`@serve-tools/client-messaging`](../../client/messaging/) for typed requests and every subscription occurrence.
Use this adapter for the latest subscription state in a reactive view.
For a complete shared-worker setup, follow the underlying client's [worker entrypoints](../../client/messaging/#usage); `observe()` accepts that connected client unchanged.

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
