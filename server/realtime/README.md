# @serve-tools/server-realtime

`@serve-tools/server-realtime` is the sans-I/O request and subscription server shared by the Serve Tools realtime transports.
It maps complete binary messages to typed handlers without owning a socket, stream, or HTTP exchange.

## Install

```shell
npm install @serve-tools/server-realtime
```

Most servers should use `@serve-tools/server-websocket`, `@serve-tools/server-webtransport`, or `@serve-tools/server-sse`.
Use this package to implement another adapter.

## Build an adapter

```ts
import { createConnection, type Handlers } from "@serve-tools/server-realtime";

interface Protocol {
	requests: { identity(): string };
	subscriptions: { notices(): string };
}

interface Session {
	userID: string;
}

const handlers = {
	requests: {
		identity: (_input, { connection }) => connection.userID,
	},
	subscriptions: {
		notices: (_input, { emit, signal }) => {
			const off = source.listen(emit);
			signal.addEventListener("abort", off, { once: true });
			return off;
		},
	},
} satisfies Handlers<Protocol, Session>;

const connection = createConnection(
	handlers,
	{
		send: (payload) => transport.send(payload),
		close: (code, reason) => transport.close(code, reason),
		bufferedAmount: () => transport.bufferedAmount,
	},
	{ userID: "verified-user" },
);

transport.onBinaryMessage(connection.receive);
transport.onInvalidInput(connection.fail);
transport.onClose(connection.disconnect);
```

The core owns operation IDs, one abort signal per operation, duplicate-ID protection, cleanup, serialization, and graceful protocol closure.
`receive()` expects one complete message; frame reliable byte streams with `@serve-tools/realtime-protocol/stream`.

The defaults allow 16 MiB per incoming message, 16 MiB in an observable send queue, and 1,024 active operations.
Override `maximumMessageLength`, `maximumBufferedAmount`, or `maximumOperations` where appropriate.
Exceeding observable backpressure closes the connection rather than dropping ordered protocol messages.

Handler errors are stack-redacted by default.
Use `formatError()` only for information intentionally exposed to a client and `reportError()` for failures that cannot be delivered remotely.

## Boundaries

The adapter owns native protocol negotiation, authentication, authorization context creation, framing, origin policy, and physical transport shutdown.
The core does not retry, resume, persist, or provide demand signaling.
Protocol declarations are compile-time contracts, so validate untrusted inputs.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-server-realtime`](./skills/serve-tools-server-realtime/SKILL.md).

## License

[MIT-0](./LICENSE.md)
