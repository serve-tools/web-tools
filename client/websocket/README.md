# @serve-tools/client-websocket

`@serve-tools/client-websocket` provides typed requests and subscriptions over a client-owned browser `WebSocket`.
It uses a compact binary protocol with built-in serialization for structured JavaScript values, including cyclic graphs and binary data.

```ts
import { connect } from "@serve-tools/client-websocket";

await using client = await connect<{
	requests: {
		getRoom(input: { room: string }): { title: string };
	};
	subscriptions: {
		presence(input: { room: string }): { online: number };
	};
}>("wss://example.com/presence");

const room = await client.request("getRoom", { room: "lobby" });

using presence = client.subscribe("presence", { room: "lobby" }, (event) => {
	console.log(`${room.title}: ${event.online} online`);
});
```

## Install

```shell
npm install @serve-tools/client-websocket
```

Use [`@serve-tools/server-websocket`](../../server/websocket/) for the matching server core and runtime adapters.
Both packages depend on [`@serve-tools/realtime-protocol`](../../realtime/protocol/) for the same versioned binary wire contract.
This client package does not expose a raw-frame API.

`connect()` opens a page-owned WebSocket and returns a typed client after the connection is ready.
Request return types describe responses; subscription return types describe emitted values.
These types are compile-time only, so validate server data at runtime.

The client owns the physical WebSocket.
Disposing it closes the connection and releases every active request and subscription.

## Protocol and operation details

### Declare a protocol

Declare named request and subscription operations as functions with zero or one input parameter.
A request function's return type is its response, while a subscription function's return type is each emitted event.

```ts
interface BoardProtocol {
	requests: {
		createBoard: (input: { title: string }) => Promise<{ boardID: string }>;
		getServerTime: () => Date;
	};
	subscriptions: {
		strokes: (input: { boardID: string }) => { points: Float32Array; color: string };
		announcements: () => string;
	};
}
```

The `requests` and `subscriptions` sections are optional, so a protocol may expose only one operation kind.
`Promise` return types are unwrapped for requests.
Subscription return types are used as written for emitted events, so declare the event value rather than a `Promise` of it.
The declarations constrain client code at compile time; they do not validate values received from the server.

### Connect and own the socket

`connect()` resolves after the native WebSocket opens and returns a client that owns that socket.
Dispose or close the client to close the socket and release every active operation.

```ts
const controller = new AbortController();

await using client = await connect<BoardProtocol>("wss://example.com/whiteboard", {
	signal: controller.signal,
});

await client.closed;
```

The client always offers and requires the `serve-tools.realtime.v1` native WebSocket subprotocol.
This socket is protocol-owned, so application code cannot add another subprotocol or mix unrelated frames.
The connection signal cancels only the opening handshake.
After connection, cancel individual operations with their own signals and close the client when the session should end.

`client.closed` resolves when the connection has completely closed, including after a transport or protocol failure.
It never rejects, so observe operation failures separately before awaiting it as a lifecycle barrier.

### Send requests

Call `request()` with an operation name, its input when required, and optional cancellation settings.
Requests may run concurrently and may settle out of order.

```ts
const controller = new AbortController();

const board = await client.request("createBoard", { title: "Sprint review" }, {
	signal: controller.signal,
});

const serverTime = await client.request("getServerTime", undefined, {
	signal: controller.signal,
});
```

Pass `undefined` before the options object for a zero-input operation.
Aborting an active request sends a cancellation message when possible and rejects the local promise with the signal's reason.
A server rejection becomes a `RemoteError` with the remote name, message, and optional stack.

### Subscribe to events

Call `subscribe()` with an operation name, its input when required, an event listener, and optional lifecycle callbacks.
Events for one subscription arrive in WebSocket order.

```ts
using subscription = client.subscribe(
	"strokes",
	{ boardID: board.boardID },
	(stroke) => {
		canvas.draw(stroke.points, stroke.color);
	},
	{
		signal: controller.signal,
		onComplete: () => console.log("complete"),
		onError: (error) => console.error(error),
	},
);
```

The returned `Subscription` exposes `active`, `unsubscribe()`, and `[Symbol.dispose]()`, and cleanup is idempotent.
Aborting, unsubscribing, or disposing performs local cancellation and does not call `onComplete` or `onError`.
A server completion calls `onComplete`, while a server, transport, or protocol failure calls `onError` when provided.
Without `onError`, subscription failures are reported through `reportError()`.

For a zero-input subscription, pass the listener directly; no `undefined` placeholder is needed before it.

```ts
using announcements = client.subscribe("announcements", console.log, {
	signal: controller.signal,
});
```

The client does not add demand signaling, buffering limits, or backpressure.
Build application-level flow control into the protocol when producers can outpace consumers.

### Send structured and binary values

Request inputs, responses, and subscription events may contain the following values:

- primitives, `undefined`, `bigint`, and special numeric values;
- plain objects, arrays, sparse arrays, cycles, and shared references;
- `Date`, `RegExp`, `Map`, `Set`, boxed primitives, and `Error` values;
- `ArrayBuffer`, `DataView`, and typed arrays, including shared backing-buffer relationships;
- resizable `ArrayBuffer` values when the runtime supports them.

This makes structured and binary responses direct and type-safe:

```ts
interface ExportProtocol {
	requests: {
		exportBoard: (input: { boardID: string }) => {
			png: Uint8Array;
			contributors: Map<string, Date>;
		};
	};
}

await using exporter = await connect<ExportProtocol>("wss://example.com/whiteboard");
const exported = await exporter.request("exportBoard", { boardID: "sprint-review" });

for (const [userID, lastEdit] of exported.contributors) {
	console.log(userID, lastEdit.toLocaleString());
}
```

Functions, symbols, weak collections, `SharedArrayBuffer`, and unsupported host objects throw `DataCloneError`.
The codec is fixed and has no transfer-list or custom-serializer extension point.
WebSocket transmission copies binary data rather than transferring ownership.

### Share an inferred protocol

Use `ProtocolType` when an API should expose the protocol carried by a client without repeating its declaration.

```ts
import type { ProtocolType } from "@serve-tools/client-websocket";

type PendingProtocol = ProtocolType<ReturnType<typeof connect<BoardProtocol>>>;
type ConnectedProtocol = ProtocolType<typeof client>;
```

`ProtocolType<T>` unwraps promise-like client values.

## Errors and lifecycle

- A failed or aborted handshake rejects `connect()` and closes the socket.
- A request serialization failure rejects that request promise, while a subscription serialization failure throws from `subscribe()`.
- A remote request rejection becomes `RemoteError`.
- A malformed or unsupported frame closes the connection with a protocol failure.
- Closing or disposing the client rejects active requests and silently deactivates active subscriptions.
- A remote, transport, or protocol close rejects active requests and reports errors to active subscriptions.
- Exceptions thrown by subscription listeners or lifecycle callbacks are reported through `reportError()` and do not change the subscription lifecycle.

The client does not retry, reconnect, resume subscriptions, replay requests, or persist messages.
If the application reconnects, create a new client and explicitly decide which idempotent operations are safe to recreate.

## Trust boundary

Protocol declarations are compile-time contracts, not runtime validation.
Validate untrusted response and event values before using them in security-sensitive code.

Transport security, authentication, authorization, and origin policy remain application and server responsibilities.
The package performs native WebSocket subprotocol negotiation and rejects a server that does not select `serve-tools.realtime.v1`.
Use `wss:` for network connections that require transport encryption.
Do not share the underlying socket with other framing protocols because the client owns it and treats every incoming message as a package protocol frame.

## Public API

- `connect<P>(url, options?)` opens a client-owned WebSocket and resolves to `Client<P>`.
- `Client<P>` exposes requests, subscriptions, `closed`, and `close()`; receive-side adapter controls are intentionally not public.
- `RemoteError` represents a failure returned by the remote endpoint.
- `Client`, `ConnectOptions`, `Protocol`, `ProtocolType`, `RequestOptions`, `SubscribeOptions`, and `Subscription` are exported types.
- The `connect` namespace also exposes `Client`, `Options`, `Protocol`, `ProtocolType`, `RequestOptions`, `SubscribeOptions`, and `Subscription` for APIs organized around the entrypoint.

## Compatibility

The package targets modern browser windows and workers with `WebSocket`, `ArrayBuffer`, `TextEncoder`, `TextDecoder`, `Promise.withResolvers()`, and `reportError()`.
Binary messages are received as `ArrayBuffer` values.
The explicit resource management examples require native or transpiled `using` support and a `Symbol.dispose` implementation.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-websocket`](./skills/serve-tools-client-websocket/SKILL.md).
Install or link that directory into your agent's skill directory when you want package-specific protocol modeling, cancellation, cleanup, binary-data, failure-handling, and trust-boundary guidance.

## Development

```shell
npm ci --ignore-scripts
npm run verify
```

Core usage patterns are compile-checked by the TypeScript recipe fixture in [`test/client-websocket.recipes.ts`](./test/client-websocket.recipes.ts).

Run the client loopback benchmark with:

```shell
npm run benchmark --workspace @serve-tools/client-websocket
```

Set `BENCHMARK_JSON=1` for machine-readable output and use `BENCHMARK_DURATION_MS` to change the default `500` ms measurement window.
The shared serializer benchmark now belongs to `@serve-tools/realtime-protocol`.

## License

[MIT-0](./LICENSE.md)
