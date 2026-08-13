# @serve-tools/client-messaging

The `@serve-tools/client-messaging` package helps you manage requests and subscriptions across workers and message ports.

```ts
import { connect, serve, type WorkerOperation } from "@serve-tools/client-messaging";

type GreetingProtocol = {
	requests: { greet: WorkerOperation<string, string> };
	subscriptions: Record<never, never>;
};

const { port1, port2 } = new MessageChannel();

using server = serve<GreetingProtocol>(port1, {
	requests: {
		greet: (name) => `Hello, ${name}!`,
	},
	subscriptions: {},
});

using client = connect<GreetingProtocol>(port2);

console.log(await client.request("greet", "Ada")); // "Hello, Ada!"
```

## Install

```shell
npm install @serve-tools/client-messaging
```

## Usage

The `scope/window` entrypoint exports `SharedWorker`, which extends the platform class with a `client` property.

The `scope/worker` entrypoint exports `listen<Protocol>(handlers)` for either a dedicated or shared worker scope.
In a dedicated worker, the returned listener immediately contains its active server.
In a shared worker, it tracks each active server as its connection arrives.
Closing the listener stops accepting shared-worker connections and closes every active server.
The inline `WorkerProtocol` supplies contextual types to every handler.
`ProtocolType<typeof connections>` extracts that retained protocol so the worker can export it without a separate declaration module.

### Message endpoints

The root entrypoint exports `connect()` and `serve()` for direct control over a dedicated `Worker`, its global scope, a shared-worker port, or either end of a `MessageChannel`:

```ts
import { connect, serve, type ProtocolType } from "@serve-tools/client-messaging";

const client = connect<CounterProtocol>(workerOrPort);
const server = serve<CounterProtocol>(workerScopeOrPort, handlers);
```

`ProtocolType` also extracts the protocol retained by a single server, so another endpoint can reference it without repeating the inline declaration:

```ts
type ServedProtocol = ProtocolType<typeof server>;

const client = connect<ServedProtocol>(clientEndpoint);
```

Once connected or served, an endpoint is protocol-owned and must not also carry unrelated application messages.

### Requests

`client.request(name, input, options?)` correlates one named operation with one promised result.
Multiple requests may be in flight at once and may settle in any order.
A handler may return its result directly or through a promise.

Operations declared with `void` input omit the input argument:

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

`client.subscribe(name, input, listener, options?)` delivers ordered values until either peer completes, fails, cancels, or closes the operation.
A `void` input is omitted in the same way as it is for requests.

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

Thrown handler errors reject requests as `WorkerRemoteError` instances with the remote `name`, `message`, and stack.
A subscription reports its terminal failure through `onError`.

`WorkerClient`, `WorkerServer`, and `WorkerSubscription` implement explicit resource management.
`client.closed` and `server.closed` resolve after explicit local or remote closure.
Browsers do not consistently report an abruptly destroyed peer, so these promises intentionally do not claim to be tab-liveness signals.
Applications that require crash detection should add a heartbeat policy at the application layer.

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

- The root entrypoint exports `connect`, `serve`, `transfer`, and `WorkerRemoteError`.
- `@serve-tools/client-messaging/scope/window` exports the `SharedWorker` convenience class.
- `@serve-tools/client-messaging/scope/worker` exports `listen<Protocol>(handlers)` for dedicated and shared worker scopes.
- `WorkerOperation` and `WorkerProtocol` define explicit operations, while `WorkerHandlers` implements them.
- `ProtocolType` extracts the retained protocol from a `WorkerServer` or the result of worker-scope `listen()`.
- `WorkerClient`, `WorkerServer`, `WorkerListener`, and `WorkerSubscription` describe active resources.
- `WorkerRequestOptions`, `WorkerSubscribeOptions`, `WorkerRequestContext`, and `WorkerSubscriptionContext` describe cancellation and handler state.
- `WorkerTransferResult` associates a result with native `Transferable` objects, and `MessageEndpoint` describes a compatible transport.

## Compatibility

The root entrypoint works with event-target-style endpoints in browser windows, dedicated workers, shared workers, and `MessageChannel`s.
It also works with structurally compatible endpoints in Node.js, although the `./scope/window` and `./scope/worker` entrypoints are browser-specific.
Values must be supported by the endpoint's structured-clone algorithm, and transferables must be valid for that runtime.

Using `using` for automatic cleanup requires compiler and runtime support for `Symbol.dispose`, or a compatible polyfill.
The equivalent `close()` and `unsubscribe()` methods are always available.

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
