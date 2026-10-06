# @serve-tools/client-messaging

Call a worker with a typed request and observe a stream of typed results without writing message IDs or response dispatchers.
The worker owns shared state; every page gets a typed client with one constructor call.

```ts
// counter-worker.ts
import { listen } from "@serve-tools/client-messaging/scope/worker";

let total = 0;
const subscribers = new Set<(value: number) => void>();
const connections = listen<{
	requests: { increment(amount: number): number };
	subscriptions: { totals(): number };
}>({
	requests: {
		increment(amount) {
			total += amount;
			for (const emit of subscribers) emit(total);
			return total;
		},
	},
	subscriptions: {
		totals(_input, { emit }) {
			subscribers.add(emit);
			emit(total);
			return () => subscribers.delete(emit);
		},
	},
});
export type CounterProtocol = listen.ProtocolType<typeof connections>;
```

```ts
// page.ts
import { SharedWorker } from "@serve-tools/client-messaging/scope/window";
import type { CounterProtocol } from "./counter-worker.js";

const worker = new SharedWorker<CounterProtocol>(new URL("./counter-worker.js", import.meta.url), {
	name: "counter",
	type: "module",
});
const output = document.createElement("output");
document.body.append(output);
const totals = worker.client.subscribe("totals", (value) => { output.value = String(value); });

addEventListener("pagehide", () => {
	totals.unsubscribe();
	worker.client.close();
	worker.port.close();
});

console.log(await worker.client.request("increment", 2)); // 2 in a newly started worker.
// Every subscribed page displays the worker's updated total.
```

Open two same-origin tabs with the same worker URL and name: they share one counter, and both outputs follow each increment.
The worker returns a cleanup for each subscription; closing a page client runs its cleanup while other pages continue using the worker.
The protocol type is exported from the worker and imported as a type by the page, so request names, inputs, and results stay aligned.
[Try the shared-state demo](./demo/) in two tabs, then try cancelling worker work or transferring an `ArrayBuffer` without copying it.
Use [SignalMessaging](../../client-signals/messaging/) to expose the latest subscription value as reactive state.
For pages restored from the back/forward cache, use the [mount and restore recipe](#backforward-cache) below to create a fresh connection.

## Install

```shell
npm install @serve-tools/client-messaging
```

#### Import from a CDN

```js
import * as clientMessaging from "https://esm.run/@serve-tools/client-messaging";
```

## Usage

Declare each operation as a callable method with either zero parameters or one input parameter.
The `requests` and `subscriptions` sections are optional, so omit an unused section instead of declaring an empty record:

```ts
interface CounterProtocol {
	requests: {
		current(): number;
		increment(amount: number): number;
	};
	subscriptions: {
		totals(): number;
		changes(projectID: string): { title: string };
	};
}
```

For requests, the client resolves to `Awaited<ReturnType<Operation>>`, so a declaration may return either a value or a promise of that value.
For subscriptions, each event is the operation's raw `ReturnType<Operation>` without promise unwrapping.

The `scope/window` entrypoint exports `SharedWorker`, which extends the platform class with a `client` property.
It also exports `connect()` for direct access to the same client surface.

The `scope/worker` entrypoint exports `listen<Protocol>(handlers)` for either a dedicated or shared worker scope.
In a dedicated worker, the returned listener immediately contains its active server.
In a shared worker, it tracks each active server as its connection arrives.
Closing the listener stops accepting shared-worker connections and closes every active server.
`ProtocolType<typeof connections>` extracts that retained protocol so the worker can export it without a separate declaration module.

### Message endpoints

The root entrypoint exports `connect()` and `serve()` for direct control over a dedicated `Worker`, its global scope, a shared-worker port, or either end of a `MessageChannel`:

```ts
import { connect, serve, type ProtocolType } from "@serve-tools/client-messaging";

const client = connect<CounterProtocol>(workerOrPort);
const server = serve<CounterProtocol>(workerScopeOrPort, handlers);
```

`ProtocolType` extracts the retained protocol from a `Client`, `Server`, or `Listener`, including a promise-wrapped branded value:

```ts
type ClientProtocol = ProtocolType<typeof client>;
type ServedProtocol = ProtocolType<typeof server>;
type ListenedProtocol = ProtocolType<typeof connections>;
type PendingProtocol = ProtocolType<Promise<typeof client>>;

const client = connect<ServedProtocol>(clientEndpoint);
```

Once connected or served, an endpoint is protocol-owned and must not also carry unrelated application messages.
Because `MessagePort` has no native subprotocol negotiation, the client sends an explicit `HELLO` and the server replies with `WELCOME` before operation messages are accepted.
`client.ready` resolves after that application handshake.

### Requests

`client.request(name, input?, options?)` correlates one named operation with one promised result.
Multiple requests may be in flight at once and may settle in any order.
A handler may return its result directly or through a promise.

Zero-input methods omit the input argument, while one-input methods require it:

```ts
const current = await client.request("current");
const next = await client.request("increment", 2);
```

Pass `undefined` as the input placeholder when a no-input request also needs options:

```ts
const current = await client.request("current", undefined, { signal });
```

Unknown operation names and thrown handler errors reject instead of leaving the request pending.
Results that cannot be structured-cloned, including invalid transfer lists, reject with the corresponding serialization error.

### Subscriptions

`client.subscribe(name, input?, listener, options?)` delivers ordered values until either peer completes, fails, cancels, or closes the operation.
A zero-input subscription takes its listener immediately after the name, while a one-input subscription takes its input first:

```ts
const totals = client.subscribe("totals", renderTotal);
const changes = client.subscribe("changes", "web-tools", (change) => console.log(change.title));
```

The listener runs when each message is received.
Subscriptions intentionally do not invent flow control over `postMessage`; applications producing unbounded or expensive event streams should batch, sample, or acknowledge events in their own protocol.

### Cancellation

Every operation has a server-side `AbortSignal`.
Aborting a request rejects its promise and aborts the corresponding handler:

```ts
import { connect, serve } from "@serve-tools/client-messaging";

interface CancelProtocol {
	requests: { wait(milliseconds: number): string };
	subscriptions: { totals(): number };
}

const channel = new MessageChannel();
const server = serve<CancelProtocol>(channel.port1, {
	requests: {
		wait(milliseconds, { signal }) {
			return new Promise<string>((resolve, reject) => {
				const abort = () => {
					clearTimeout(timer);
					reject(signal.reason);
				};
				const timer = setTimeout(() => {
					signal.removeEventListener("abort", abort);
					resolve("finished");
				}, milliseconds);
				signal.addEventListener("abort", abort, { once: true });
				if (signal.aborted) abort();
			});
		},
	},
	subscriptions: {
		totals(_input, { emit }) {
			let total = 0;
			const timer = setInterval(() => emit(++total), 100);
			return () => clearInterval(timer);
		},
	},
});
const client = connect<CancelProtocol>(channel.port2);

try {
	await client.ready;
	const requestController = new AbortController();
	const pending = client.request("wait", 10_000, { signal: requestController.signal });
	requestController.abort();
	try {
		await pending;
	} catch (error) {
		if (error !== requestController.signal.reason) throw error;
		console.log("Request cancelled");
	}

	// A fresh signal starts a separate operation; an aborted signal cannot be reused.
	const subscriptionController = new AbortController();
	const totals = client.subscribe("totals", console.log, {
		signal: subscriptionController.signal,
		onError: console.error,
	});
	await new Promise<void>((resolve) => setTimeout(resolve, 250));
	subscriptionController.abort(); // Stops delivery and clears the server's interval.
	totals.unsubscribe(); // Also safe after cancellation.
} finally {
	client.close();
	server.close();
	channel.port1.close();
	channel.port2.close();
}
```

The request's expected abort rejection is caught; the independent subscription remains usable until its own signal aborts.
A handler must pass its signal to cancellable work or listen for abort itself, as the timer above does.
`unsubscribe()` is an alternative to aborting a subscription.

A subscription cleanup returned by its handler runs once after completion, failure, cancellation, connection closure, or disposal.

### Transfer lists

Request inputs use the standard transfer-list option.
Wrap worker results and subscription events with `transfer()`:

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

The request, subscription, cancellation, transfer, and disposal patterns above are covered by the package's TypeScript fixtures in addition to its runtime protocol tests.

## Errors and lifecycle

Thrown handler errors reject requests as `RemoteError` instances with the remote `name`, `message`, and stack.
A subscription reports its terminal failure through `onError`.

`Client`, `Server`, and `Subscription` implement explicit resource management.
`client.closed` and `server.closed` resolve after explicit local or remote closure.

If an endpoint's optional `start()` throws, `connect()` and `serve()` remove their protocol listeners and rethrow the original error without closing the underlying transport.
The server also aborts any operations accepted during startup, cancels its lease watch, and runs subscription cleanup even if the handler returns it after startup fails.

### Liveness detection

A `MessagePort` cannot report an abruptly destroyed peer, such as a crashed or discarded tab holding a `SharedWorker` port.
The library covers that gap automatically: each client acquires a uniquely named Web Lock and only then announces it to the serving peer, and the browser releases the lock when the client's agent is destroyed for any reason.
The server watches the announced lock and finishes — aborting handlers and running subscription cleanups — when it is released.
When Web Locks are available on both sides, peers must share the same [Web Locks storage bucket](https://www.w3.org/TR/web-locks/#lock-managers), normally same-origin windows and workers in the same storage partition.
Cross-origin or separately partitioned transferred ports are not supported by this lease protocol.
The handshake and operations do not wait for lease acquisition.
Automatic abrupt-peer detection starts only after the lease has been announced.
Closing the client cancels pending lease acquisition and releases a held lease; a grant observed after closure is not announced.
Closure is final: late protocol events cannot reopen a closed client.
The lease requires no configuration; where Web Locks are unavailable or acquisition fails, messaging continues without automatic abrupt-peer detection.

### Back/forward cache

To keep pages eligible for the back/forward cache, a window client also closes itself automatically on `pagehide`, releasing its lease before the page is snapshotted.
The lease never blocks caching on its own; note, however, that Chrome currently declines to cache any page connected to a `SharedWorker` (reported as `SharedWorkerWithNoActiveClient` in its bfcache diagnostics), which is a platform constraint independent of this library.
A page restored from the cache must create a fresh worker connection and re-subscribe, for example from a `pageshow` listener when `event.persisted` is `true`.
Do not call `connect()` again on the old port: its serving peer has already closed that protocol connection.

```ts
// page.ts — uses the counter-worker.ts module from the opening example.
import { SharedWorker } from "@serve-tools/client-messaging/scope/window";
import type { CounterProtocol } from "./counter-worker.js";

const output = document.createElement("output");
document.body.append(output);

const mount = () => {
	const worker = new SharedWorker<CounterProtocol>(new URL("./counter-worker.js", import.meta.url), {
		name: "counter",
		type: "module",
	});
	const totals = worker.client.subscribe("totals", (value) => {
		output.value = String(value);
	});
	return () => {
		totals.unsubscribe();
		worker.client.close();
		worker.port.close();
	};
};

let dispose: (() => void) | undefined = mount();
addEventListener("pagehide", () => {
	dispose?.();
	dispose = undefined;
});
addEventListener("pageshow", (event) => {
	if (event.persisted && !dispose) dispose = mount();
});
```

Keep both listeners registered across repeated cache restorations.
Unlike a page-owned resource that can be suspended, these worker protocol connections are closed on every `pagehide`, including one with `persisted: true`.
Shared transport adapters use the same pattern: create a new native `SharedWorker`, call their window `connect()` with its new port, and restore subscriptions inside `mount()`.

When explicit resource management fits the surrounding code, clients and subscriptions can instead be scoped with `using`.
Resources are disposed in reverse declaration order, so the subscription closes before its client:

```ts
{
	using client = connect<CounterProtocol>(worker.port);
	using totals = client.subscribe("totals", renderTotal);

	await client.request("increment", 2);
}
```

Closing a client or server sends the protocol close frame and removes library listeners, but does not call a transport-specific `close()` or `terminate()` method.
A page that owns a `SharedWorker` port should close that port after closing its client; code that owns a dedicated `Worker` decides separately whether to terminate it.

Messages retain the ordering guarantees of their underlying endpoint.
The protocol does not retry, persist, or claim delivery after a worker or document is destroyed.

## Public API

- The root entrypoint exports `connect`, `serve`, `transfer`, `RemoteError`, and the generic types `Client`, `Server`, `Listener`, `Handlers`, `Subscription`, `RequestOptions`, `SubscribeOptions`, `RequestContext`, `SubscriptionContext`, `TransferResult`, `MessageEndpoint`, `Protocol`, and `ProtocolType`.
- The root `connect` namespace exposes `Client`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestOptions`, `SubscribeOptions`, and `Subscription`.
- The root `serve` namespace exposes `Handlers`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestContext`, `Server`, `SubscriptionContext`, and `TransferResult`.
- `@serve-tools/client-messaging/scope/window` exports the `SharedWorker` convenience class, `connect`, `transfer`, and all generic types.
  Its `connect` namespace has the same surface as the root `connect` namespace.
- `@serve-tools/client-messaging/scope/worker` exports `listen`, `transfer`, and all generic types.
  Its `listen` namespace exposes `Handlers`, `Listener`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestContext`, `Server`, `SubscriptionContext`, and `TransferResult`.

The protocol and resource declarations are compile-time only and emit no runtime values.
The wire protocol identifier is `@serve-tools/client-messaging/3`; peers must complete its explicit `HELLO`/`WELCOME` handshake.

## Trust boundary

The protocol exists only at compile time.
Validate values received from an untrusted execution context.
Once passed to `connect()` or `serve()`, an endpoint is protocol-owned and must not also carry unrelated application messages.

## Demo

The [`demo`](./demo) workspace contains four focused SharedWorker examples for requests, shared subscriptions, cancellation, and transferable data:

[Try the demo in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/messaging/demo)

The demo directory is standalone-importable and installs the published package when it is used outside this repository.
To run it against the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-messaging
npm run dev --workspace @serve-tools/client-messaging-demo
```

## Agent Skill

This package includes `skills/serve-tools-client-messaging/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs the protocol suite in Node.js and the SharedWorker integration suite in Chromium, Firefox, and WebKit.
Install the pinned Playwright browsers once before running it locally:

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/client-messaging
```

Run the opt-in Chromium benchmarks for `MessagePort` request round trips and transferable buffers with:

```shell
npm run benchmark --workspace @serve-tools/client-messaging
```

Benchmark results report warmup-separated mean, median, p95, and operations per second.
They are descriptive measurements and do not impose environment-sensitive pass/fail thresholds.

## License

[MIT-0](./LICENSE.md)
