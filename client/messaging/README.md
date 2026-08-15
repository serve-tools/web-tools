# @serve-tools/client-messaging

The `@serve-tools/client-messaging` package helps you manage typed requests and subscriptions across workers and message ports.

```ts
import { connect, serve } from "@serve-tools/client-messaging";

const { port1, port2 } = new MessageChannel();

type GreetingProtocol = {
	requests: {
		greet(name: string): string;
	};
};

using server = serve<GreetingProtocol>(port1, {
	requests: {
		greet: (name) => `Hello, ${name}!`,
	},
});

using client = connect<GreetingProtocol>(port2);

console.log(await client.request("greet", "Ada")); // "Hello, Ada!"
```

## Install

```shell
npm install @serve-tools/client-messaging
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
const changes = client.subscribe("changes", projectID, renderChange);
```

The listener runs when each message is received.
Subscriptions intentionally do not invent flow control over `postMessage`; applications producing unbounded or expensive event streams should batch, sample, or acknowledge events in their own protocol.

### Cancellation

Every operation has a server-side `AbortSignal`.
Aborting a request rejects its promise and aborts the corresponding handler:

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

### Liveness detection

A `MessagePort` cannot report an abruptly destroyed peer, such as a crashed or discarded tab holding a `SharedWorker` port.
The library covers that gap automatically: each client holds a uniquely named Web Lock and announces it to the serving peer, and the browser releases the lock when the client's agent is destroyed for any reason.
The server watches the announced lock and finishes — aborting handlers and running subscription cleanups — when it is released.
The lease requires no configuration; it is skipped only where Web Locks are unavailable, and closing the client releases it immediately.

### Back/forward cache

To keep pages eligible for the back/forward cache, a window client also closes itself automatically on `pagehide`, releasing its lease before the page is snapshotted.
The lease never blocks caching on its own; note, however, that Chrome currently declines to cache any page connected to a `SharedWorker` (reported as `SharedWorkerWithNoActiveClient` in its bfcache diagnostics), which is a platform constraint independent of this library.
A page restored from the cache must reconnect and re-subscribe, for example from a `pageshow` listener when `event.persisted` is `true`:

```ts
addEventListener("pageshow", (event) => {
	if (event.persisted) {
		client = connect<CounterProtocol>(worker.port);
	}
});
```

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
The `@serve-tools/client-messaging/2` protocol constant did not change; the added liveness lease frame is safely ignored by peers that predate it.

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
