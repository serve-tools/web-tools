# @serve-tools/client-realtime

`@serve-tools/client-realtime` is the transport-neutral client state machine behind the Serve Tools realtime transports.
It provides typed requests and subscriptions over a complete-message byte callback without opening a socket or stream.

## Install

```shell
npm install @serve-tools/client-realtime
```

Most applications should use `@serve-tools/client-websocket`, `@serve-tools/client-webtransport`, or `@serve-tools/client-sse`.
Use this package when building another transport adapter.

## Build an adapter

```ts
import { createClient } from "@serve-tools/client-realtime";

interface Protocol {
	requests: { add(input: { a: number; b: number }): number };
	subscriptions: { notices(): string };
}

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
```

`send()` receives one complete serialized protocol message.
Call `receive()` once for each complete incoming message; byte streams need `FrameDecoder` and `encodeFrame` from `@serve-tools/realtime-protocol/stream`.
Call `fail()` when the peer violates the protocol, and `disconnect()` after the physical transport is already gone.

The returned adapter connection adds `receive()`, `fail()`, and `disconnect()` to the typed `request()`, `subscribe()`, `closed`, and `close()` client surface.
Network packages expose only the client surface so application code cannot invoke adapter lifecycle controls.
It owns protocol state, operation IDs, cancellation, decoding, remote errors, and callback failure isolation.

## Boundaries

This package does not perform transport negotiation, authentication, framing, retry, reconnection, or runtime validation of declared protocol values.
An adapter must establish the `serve-tools.realtime.v1` application protocol before giving peer bytes to the core.
Do not multiplex unrelated messages through a protocol-owned connection.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-realtime`](./skills/serve-tools-client-realtime/SKILL.md).

## License

[MIT-0](./LICENSE.md)
