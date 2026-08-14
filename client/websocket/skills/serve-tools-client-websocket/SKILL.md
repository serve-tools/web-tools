---
name: serve-tools-client-websocket
description: Use @serve-tools/client-websocket for typed request and subscription protocols over owned browser WebSockets.
---

# Use @serve-tools/client-websocket

## Declare the protocol

1. Declare `requests` and `subscriptions` with TypeScript method signatures.
2. Give each operation zero parameters or one structured input value.
3. Treat a request return type as its promised response and a subscription return type as each emitted event.
4. Omit an unused `requests` or `subscriptions` section instead of adding an empty record.

```ts
interface Protocol {
	requests: {
		status(): Status;
		save(input: SaveInput): Revision;
	};
	subscriptions: {
		changes(projectID: string): Change;
	};
}
```

Protocol declarations and `ProtocolType` extraction provide compile-time typing only.
Extracting a type from a pending or resolved client does not change wire frames or protocol constants.
Validate values from an untrusted server at the application boundary.

## Own the connection

- Await `connect<Protocol>(url, options)` before sending operations.
- Pass an `AbortSignal` to cancel the opening handshake.
- Close or dispose the returned client; it owns and closes its WebSocket.
- Use `client.closed` to observe connection termination.
- Do not add hidden reconnection, retry, persistence, or replay semantics.

## Use requests and subscriptions

- Use `request()` for finite work that settles once.
- Use `subscribe()` for ordered events over time.
- Pass `undefined` before options for a no-input request.
- Dispose or unsubscribe every active subscription.
- Handle terminal subscription failures with `onError` when they should not be reported globally.
- Add application batching, sampling, acknowledgement, or flow control for unbounded producers.

## Preserve the binary protocol

- Send structured values directly; do not JSON-stringify them.
- Expect cycles, maps, sets, dates, errors, buffers, typed arrays, and repeated references to retain clone semantics.
- Do not pass functions, symbols, weak collections, `SharedArrayBuffer`, or platform-specific host objects.
- Do not add codec, serializer, replacer, reviver, or transfer-list options.
- The remote server must implement the same versioned wire protocol.

## Share inline protocol types

Extract directly from either the pending `connect()` promise or its resolved client; do not wrap the input in `Awaited`.
Use the top-level `ProtocolType` export for separate type imports or `connect.ProtocolType` through the function namespace.

```ts
import { connect, type ProtocolType } from "@serve-tools/client-websocket";

const pendingClient = connect<{
	requests: { status(): Status };
}>(url);

export type PendingProtocol = ProtocolType<typeof pendingClient>;

const client = await pendingClient;
export type ResolvedProtocol = connect.ProtocolType<typeof client>;
```

Keep the extracted type as the single reference shared with compatible server code.

## Validate changes

Update runtime behavior, public types, README examples, Node protocol tests, browser serialization tests, type fixtures, benchmarks, and package metadata together.
