# @serve-tools/client-websocket

The `@serve-tools/client-websocket` package provides typed requests and subscriptions over one owned WebSocket connection.
Messages use a built-in binary structured-data format, so application values are not limited to JSON.

```ts
import { connect, type ProtocolType } from "@serve-tools/client-websocket";

const pendingClient = connect<{
	requests: {
		authenticate(credentials: Credentials): Session;
		ping(): void;
	};
	subscriptions: {
		messages(room: RoomID): Message;
	};
}>("wss://example.com/socket");

export type ChatProtocol = ProtocolType<typeof pendingClient>;

await using client = await pendingClient;
export type ResolvedChatProtocol = connect.ProtocolType<typeof client>;

const session = await client.request("authenticate", credentials);
using messages = client.subscribe("messages", roomID, renderMessage);
```

## Install

```shell
npm install @serve-tools/client-websocket
```

The server must implement the same versioned binary and messaging protocols.
The planned `@serve-tools/server-websocket` package will provide the corresponding `serve()` API; this client package does not install or configure a server.

## Protocol declarations

Declare request and subscription operations as TypeScript method signatures.
An operation accepts either no input or one structured input value.

```ts
interface ProjectProtocol {
	requests: {
		project(id: string): Project;
		save(input: { project: Project; revision: number }): Revision;
		ping(): void;
	};
	subscriptions: {
		changes(projectID: string): ProjectChange;
	};
}
```

For a request, the method return type is the response value; `client.request()` supplies its promise.
For a subscription, the return type is the type of each delivered event.
Place multiple input fields in one object rather than declaring multiple parameters.
Either `requests` or `subscriptions` may be omitted when the protocol does not use it.

Protocol declarations and `ProtocolType` extraction exist only at compile time.
Extracting a type from a pending or resolved client does not change wire frames or protocol constants.
Validate values received from an untrusted server when application correctness or security requires it.

The top-level `ProtocolType` export and `connect.ProtocolType` both extract an inline protocol directly from either a pending `connect()` promise or its resolved client; no explicit `Awaited` type is needed:

```ts
import { connect, type ProtocolType } from "@serve-tools/client-websocket";

const pendingClient = connect<{
	requests: { status(): Status };
}>(url);

export type PendingStatusProtocol = ProtocolType<typeof pendingClient>;

const client = await pendingClient;
export type StatusProtocol = connect.ProtocolType<typeof client>;
```

The client types are exported both at the package's top level and through the `connect` namespace.

## Requests

`request(name, input, options?)` sends one named operation and resolves with its response.
Multiple requests may be active concurrently and may settle in any order.

```ts
const project = await client.request("project", projectID, { signal });
```

No-input requests omit the input argument:

```ts
await client.request("ping");
```

Pass `undefined` when a no-input request also needs options:

```ts
await client.request("ping", undefined, { signal });
```

Aborting rejects the local promise and sends cancellation to the server.
Remote handler failures reject with `RemoteError` while retaining the reported name, message, and stack.

## Subscriptions

`subscribe(name, input, listener, options?)` delivers ordered events until either peer completes, rejects, cancels, or closes the operation.

```ts
using changes = client.subscribe("changes", projectID, applyChange, {
	signal,
	onComplete: () => console.log("complete"),
	onError: console.error,
});
```

The returned subscription is disposable and `unsubscribe()` is idempotent.
Subscriptions intentionally do not invent flow control over WebSocket delivery; applications producing unbounded streams should batch, sample, or acknowledge events in their own protocol.

## Structured values

Every protocol message is one binary WebSocket message containing one structured value.
The built-in serializer preserves cycles, repeated references, sparse arrays, special numbers, `BigInt`, dates, regular expressions, maps, sets, boxed primitives, errors, `ArrayBuffer`, `DataView`, typed arrays, and shared backing-buffer identity.

Functions, symbols, weak collections, `SharedArrayBuffer`, and platform-specific host objects are rejected with `DataCloneError`.
Transfer lists are not exposed because network transport cannot transfer ownership.
The serializer is fixed and cannot be replaced through client options.

## Connection lifecycle

`connect()` resolves after the native WebSocket opens and accepts an `AbortSignal` for cancelling that opening handshake.
The client owns the created WebSocket.
Calling `close()` or disposing the client closes both the messaging protocol and its WebSocket connection.
`client.closed` resolves after local closure, remote closure, a malformed protocol message, or transport failure.

```ts
await using client = await connect<ProjectProtocol>(url, {
	protocols: ["projects"],
	signal,
});

await client.closed;
```

The package does not reconnect, retry, persist, or claim delivery after disconnection.
Applications requiring session resumption or replay should define those semantics above this connection.

## Public API

- `connect()` opens an owned WebSocket and returns a typed `Client`.
- `ProtocolType` extracts the inline protocol retained by a pending or resolved client.
- `RequestOptions`, `SubscribeOptions`, `ConnectOptions`, and `Subscription` describe operation and lifecycle state.
- `RemoteError` represents a failure reported by the server.

## Compatibility

The package is an ES module for browser windows and workers with `WebSocket`, `ArrayBuffer`, `TextEncoder`, `TextDecoder`, and explicit resource management support or compatible polyfills.
Binary WebSocket messages are received as `ArrayBuffer` values.

## Agent Skill

This package includes `skills/serve-tools-client-websocket/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs protocol tests in Node.js and structured-serialization compatibility tests in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/client-websocket
```

Run the opt-in Chromium benchmarks for structured serialization and deterministic client protocol loopbacks with:

```shell
npm run benchmark --workspace @serve-tools/client-websocket
```

The loopback cases measure client protocol overhead without claiming to represent network or server latency.
Benchmark results report warmup-separated mean, median, p95, and operations per second.
They are descriptive measurements and do not impose environment-sensitive pass/fail thresholds.

## License

[MIT-0](./LICENSE.md)
