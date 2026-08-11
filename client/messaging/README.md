# @serve-tools/client-messaging

Requests and subscriptions across workers and message ports.

The API has two operation shapes: a request produces one promised result, while a subscription produces values until
it completes or is disposed. The same protocol can run over dedicated workers, shared workers, or either end of a
`MessageChannel`.

## Install

```sh
npm install @serve-tools/client-messaging
```

## Recipes

### SharedWorker

Define the operations that cross the worker boundary:

```ts
import type { WorkerOperation } from "@serve-tools/client-messaging";

export type CounterProtocol = {
	requests: {
		increment: WorkerOperation<number, number>;
		current: WorkerOperation<void, number>;
	};
	subscriptions: {
		totals: WorkerOperation<void, number>;
	};
};
```

Connect from the page with the `SharedWorker` convenience class. Requests with no input do not require an `undefined`
argument:

```ts
import { SharedWorker } from "@serve-tools/client-messaging/scope/window";
import type { CounterProtocol } from "./protocol.js";

const worker = new SharedWorker<CounterProtocol>(new URL("./worker.js", import.meta.url), { type: "module" });

const { client } = worker;
const totals = client.subscribe("totals", (total) => {
	console.log("shared total", total);
});

console.log(await client.request("current"));
console.log(await client.request("increment", 2));

addEventListener(
	"pagehide",
	() => {
		totals.unsubscribe();
		client.close();
		worker.port.close();
	},
	{ once: true },
);
```

Activate the handlers inside the shared worker. Handler state may be shared by every connected page:

```ts
import { activate, type WorkerHandlers } from "@serve-tools/client-messaging/scope/shared-worker";
import type { CounterProtocol } from "./protocol.js";

let total = 0;

const subscribers = new Set<(value: number) => void>();

const handlers = {
	requests: {
		current: () => total,
		increment: (amount) => {
			total += amount;

			for (const emit of subscribers) emit(total);

			return total;
		},
	},
	subscriptions: {
		totals: (_input, { emit }) => {
			subscribers.add(emit);
			emit(total);

			return () => subscribers.delete(emit);
		},
	},
} satisfies WorkerHandlers<CounterProtocol>;

activate<CounterProtocol>(handlers);
```

The `./scope/window` entrypoint exports `SharedWorker`, which extends the platform class with a `client` property. The
`./scope/shared-worker` entrypoint exports `activate()`, which serves every incoming shared-worker connection and
retains the resulting servers.

### Message endpoints

The root entrypoint exports `connect()` and `serve()` for direct control over a dedicated `Worker`, its global scope, a
shared-worker port, or either end of a `MessageChannel`:

```ts
import { connect, serve } from "@serve-tools/client-messaging";

const client = connect<CounterProtocol>(workerOrPort);
const server = serve<CounterProtocol>(workerScopeOrPort, handlers);
```

Once connected or served, an endpoint is protocol-owned and must not also carry unrelated application messages.

### Requests

`client.request(name, input, options?)` correlates one named operation with one promised result. Multiple requests may
be in flight at once and may settle in any order. A handler may return its result directly or through a promise.

Operations declared with `void` input omit the input argument:

```ts
const current = await client.request("current");
const next = await client.request("increment", 2);
```

Pass `undefined` as the input placeholder when a no-input request also needs options:

```ts
const current = await client.request("current", undefined, { signal });
```

Unknown operation names and thrown handler errors reject instead of leaving the request pending. Results that cannot
be structured-cloned, including invalid transfer lists, reject with the corresponding serialization error.

### Subscriptions

`client.subscribe(name, input, listener, options?)` delivers ordered values until either peer completes, fails,
cancels, or closes the operation. A `void` input is omitted in the same way as it is for requests.

The listener runs when each message is received. Subscriptions intentionally do not invent flow control over
`postMessage`; applications producing unbounded or expensive event streams should batch, sample, or acknowledge events
in their own protocol.

### Cancellation

Every operation has a server-side `AbortSignal`. Aborting a request rejects its promise and aborts the corresponding
handler:

```ts
const controller = new AbortController();
const pending = client.request("wait", 10_000, { signal: controller.signal });

controller.abort();
await pending;
```

Subscriptions accept the same option and can also be ended through their disposable handle:

```ts
using updates = client.subscribe("updates", { project: "web-tools" }, render, {
	signal: controller.signal,
	onComplete: () => console.log("complete"),
	onError: console.error,
});

updates.unsubscribe();
```

A subscription cleanup returned by its handler runs once after completion, failure, cancellation, connection closure,
or disposal.

### Transfer lists

Request inputs use the standard transfer-list option. Wrap worker results and subscription events with `transfer()`:

```ts
import { transfer } from "@serve-tools/client-messaging";

const result = await client.request("reverse", buffer, { transfer: [buffer] });

const handlers = {
	requests: {
		reverse: (buffer: ArrayBuffer) => transfer(buffer, [buffer]),
	},
	// ...
};
```

The request, subscription, cancellation, transfer, and disposal patterns above are covered by the package's TypeScript
fixtures in addition to its runtime protocol tests.

## Errors and lifecycle

Thrown handler errors reject requests as `WorkerRemoteError` instances with the remote `name`, `message`, and stack. A
subscription reports its terminal failure through `onError`.

`WorkerClient`, `WorkerServer`, and `WorkerSubscription` implement explicit resource management. `client.closed` and `server.closed`
resolve after explicit local or remote closure. Browsers do not consistently report an abruptly destroyed peer, so
these promises intentionally do not claim to be tab-liveness signals. Applications that require crash detection should
add a heartbeat policy at the application layer.

When explicit resource management fits the surrounding code, clients and subscriptions can instead be scoped with
`using`. Resources are disposed in reverse declaration order, so the subscription closes before its client:

```ts
{
	using client = connect<CounterProtocol>(worker.port);
	using totals = client.subscribe("totals", renderTotal);

	await client.request("increment", 2);
}
```

Closing a client or server sends the protocol close frame and removes library listeners, but does not call a
transport-specific `close()` or `terminate()` method. A page that owns a `SharedWorker` port should close that port after
closing its client; code that owns a dedicated `Worker` decides separately whether to terminate it.

Messages retain the ordering guarantees of their underlying endpoint. The protocol does not retry, persist, or claim
delivery after a worker or document is destroyed.

## Compatibility

The root entrypoint works with event-target-style endpoints in browser windows, dedicated workers, shared workers, and
`MessageChannel`s. It also works with structurally compatible endpoints in Node.js, although the `./scope/window` and
`./scope/shared-worker` entrypoints are browser-specific. Values must be supported by the endpoint's structured-clone
algorithm, and transferables must be valid for that runtime.

Using `using` for automatic cleanup requires compiler and runtime support for `Symbol.dispose`, or a compatible
polyfill. The equivalent `close()` and `unsubscribe()` methods are always available.

## Public API

- The root entrypoint exports `connect`, `serve`, `transfer`, and `WorkerRemoteError`.
- `@serve-tools/client-messaging/scope/window` exports the `SharedWorker` convenience class.
- `@serve-tools/client-messaging/scope/shared-worker` exports `activate` for a `SharedWorkerGlobalScope`.
- `WorkerOperation` and `WorkerProtocol` define operations; `WorkerHandlers` implements them.
- `WorkerClient`, `WorkerServer`, and `WorkerSubscription` describe active resources.
- `WorkerRequestOptions`, `WorkerSubscribeOptions`, `WorkerRequestContext`, and `WorkerSubscriptionContext` describe
  cancellation and handler state.
- `WorkerTransferResult` associates a result with native `Transferable` objects, and `MessageEndpoint` describes a
  compatible transport.

## Trust boundary

The protocol exists only at compile time. Validate values received from an untrusted execution context. Once passed to
`connect()` or `serve()`, an endpoint is protocol-owned and must not also carry unrelated application messages.

## Migrating from the Channel experiment

- Replace `new Channel(port)` with `connect<YourProtocol>(port)` on the caller and `serve(port, handlers)` on the worker.
- Replace `remote()` and `expose()` methods with named requests.
- Replace repeated callback capabilities or raw message iteration with named subscriptions.
- Pass cancellation in operation options rather than placing `AbortSignal` objects inside argument graphs.
- Use `transfer(value, transferList)` for worker-to-client transfers.
- Remove `ChannelTarget`, `Target`, `Remote`, `Moved`, `readable`, and `writable`; this package no longer implements a
  distributed object or general stream transport.

## Demo

The [`demo`](./demo) workspace contains four focused SharedWorker examples for requests, shared subscriptions,
cancellation, and transferable data:

```sh
npm run build --workspace @serve-tools/client-messaging
npm run dev --workspace @serve-tools/client-messaging-demo
```

## Development

The default test command runs the protocol suite in Node.js and the SharedWorker integration suite in Chromium,
Firefox, and WebKit. Install the pinned Playwright browsers once before running it locally:

```sh
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/client-messaging
```

## License

[MIT-0](./LICENSE.md)
