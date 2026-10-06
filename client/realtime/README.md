# @serve-tools/client-realtime

`@serve-tools/client-realtime` is the transport-neutral client state machine behind the Serve Tools realtime transports.
It provides typed requests and subscriptions over a complete-message byte callback without opening a socket or stream.

Choose this package when implementing a transport adapter: it handles operation IDs, response correlation, cancellation, remote errors, and decoding while you supply complete message delivery.
Most application code should start with [WebSocket](../websocket/), [HTTP Stream](../http-stream/), or [WebTransport](../webtransport/).

The helper below accepts an application-owned transport with the displayed callback methods; those methods are not exports of this package.
After wiring it, `await client.request("add", { a: 2, b: 3 })` yields `5` when the matching server handler returns the sum.
Retire the adapter with `client.close()` and release the physical transport through your `close` callback.
Next, add stream framing when the transport delivers chunks rather than complete messages.

## Install

```shell
npm install @serve-tools/client-realtime
```

#### Import from a CDN

```js
import * as clientRealtime from "https://esm.run/@serve-tools/client-realtime";
```

Most applications should use `@serve-tools/client-websocket`, `@serve-tools/client-webtransport`, or `@serve-tools/client-http-stream`.
Use this package when building another transport adapter.

## Build an adapter

```ts
import { createClient } from "@serve-tools/client-realtime";

interface Protocol {
	requests: { add(input: { a: number; b: number }): number };
	subscriptions: { notices(): string };
}

/** Connects an application-supplied complete-message transport. */
export function connectTransport(transport: {
	send(payload: ArrayBuffer): void;
	close(reason?: unknown): void;
	onBinaryMessage(listener: (payload: ArrayBuffer | ArrayBufferView) => void): void;
	onInvalidInput(listener: (reason: unknown) => void): void;
	onClose(listener: (reason: unknown) => void): void;
}) {
	const client = createClient<Protocol>({
		send(payload) {
			transport.send(payload);
		},
		close(reason) {
			transport.close(reason);
		},
	});

	transport.onBinaryMessage((payload) => client.receive(payload));
	transport.onInvalidInput((reason) => client.fail(reason));
	transport.onClose((reason) => client.disconnect(reason));

	return client;
}
```

`send()` receives one complete serialized protocol message.
Call `receive()` once for each complete incoming message; byte streams need `FrameDecoder` and `encodeFrame` from `@serve-tools/realtime-protocol/stream`.
Call `fail()` when the peer violates the protocol, and `disconnect()` after the physical transport is already gone.

The returned adapter connection adds `receive()`, `fail()`, and `disconnect()` to the typed `request()`, `subscribe()`, `closed`, and `close()` client surface.
Network packages expose only the client surface so application code cannot invoke adapter lifecycle controls.
It owns protocol state, operation IDs, cancellation, decoding, remote errors, and callback failure isolation.
Pass `{ maximumMessageLength }` as the second argument when the transport has a lower negotiated message limit.
It defaults to 16 MiB and bounds both complete incoming message bytes and the declared capacity of resizable `ArrayBuffer` values before allocation.

## Boundaries

This package does not perform transport negotiation, authentication, framing, retry, reconnection, or runtime validation of declared protocol values.
An adapter must establish the `serve-tools.realtime.v1` application protocol before giving peer bytes to the core.
Do not multiplex unrelated messages through a protocol-owned connection.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-realtime`](./skills/serve-tools-client-realtime/SKILL.md).

## License

[MIT-0](./LICENSE.md)
