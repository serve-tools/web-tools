# @serve-tools/server-realtime

`@serve-tools/server-realtime` is an advanced foundation for building transport adapters with typed requests, subscriptions, and cancellation.
It maps complete binary messages to typed handlers without owning a socket, stream, or HTTP exchange.

## Install

```shell
npm install @serve-tools/server-realtime
```

#### Import from a CDN

```js
import * as serverRealtime from "https://esm.run/@serve-tools/server-realtime";
```

The package root uses web APIs and can run in a browser; hosting a network server requires a server runtime.

For an application server, start with the [HTTP stream](../http-stream/), [WebSocket](../websocket/), or [WebTransport](../webtransport/) package.
Use this package to implement another adapter.

## Advanced: build a transport adapter

Try the connection core without a network server: send one encoded request and read its encoded response.
The byte callbacks are the adapter boundary; a network adapter replaces the in-memory `send()` callback and feeds incoming messages to `receive()`.

```ts
import { createConnection, type Handlers } from "@serve-tools/server-realtime";
import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";

interface Protocol {
	requests: { identity(): string };
	subscriptions: { notices(): string };
}

interface Session {
	userID: string;
}

const handlers = {
	requests: { identity: (_input, { connection }) => connection.userID },
	subscriptions: {
		notices: (_input, { emit, complete }) => {
			emit("Welcome");
			complete();
		},
	},
} satisfies Handlers<Protocol, Session>;

const reply = Promise.withResolvers<unknown>();
const connection = createConnection(
	handlers,
	{
		send: (payload) => reply.resolve(deserialize(payload)),
		close: (code, reason) => console.log("close transport", code, reason),
	},
	{ userID: "local-demo" },
);

connection.receive(serialize([protocol, "request", 1, "identity", undefined]));
console.log(await reply.promise); // [protocol, "resolve", 1, "local-demo"]
connection.disconnect();
await connection.closed;
```

Install `@serve-tools/realtime-protocol` alongside this package to use the diagnostic serialization imports.
A real adapter negotiates the protocol and verifies the session before constructing a connection.
It forwards complete incoming binary messages to `connection.receive()`, invalid input to `connection.fail()`, and physical closure to `connection.disconnect()`.

The core owns operation IDs, one abort signal per operation, duplicate-ID protection, cleanup, serialization, and graceful protocol closure.
`receive()` expects one complete message; frame reliable byte streams with `@serve-tools/realtime-protocol/stream`.
Physical transport closure is requested immediately, while `closed` resolves after in-flight handlers and asynchronous subscription cleanup settle.

The defaults allow 16 MiB per incoming message, 16 MiB in an observable send queue, and 1,024 active operations.
Override `maximumMessageLength`, `maximumBufferedAmount`, or `maximumOperations` where appropriate.
The message-length limit also clamps declared resizable `ArrayBuffer` capacity during deserialization before allocation.
Exceeding observable backpressure closes the connection rather than dropping ordered protocol messages.

Handler errors are stack-redacted by default.
Use `formatError()` only for information intentionally exposed to a client.
Thrown values that cannot be safely inspected or converted to strings use a generic stack-redacted error record.
Cleanup, formatter, and transport failures that cannot be delivered remotely use the runtime's native `reportError()` or `console.error()` when that web API is unavailable.

## Boundaries

The adapter owns native protocol negotiation, authentication, authorization context creation, framing, origin policy, and physical transport shutdown.
Its `send(payload, message)` callback receives both the serialized bytes and the original server envelope so adapters can inspect delivery metadata without decoding their own output.
The core does not retry, resume, persist, or provide demand signaling.
Protocol declarations are compile-time contracts, so validate untrusted inputs.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-server-realtime`](./skills/serve-tools-server-realtime/SKILL.md).

## License

[MIT-0](./LICENSE.md)
