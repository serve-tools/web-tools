# @serve-tools/server-webtransport

`@serve-tools/server-webtransport` serves reliable typed operations and typed best-effort datagrams over one protocol-owned WebTransport session.
Its root is a runtime-neutral session core; `runtime/node` adapts `@http3-server/server` callbacks.

## Install

```shell
npm install @serve-tools/server-webtransport @http3-server/server
```

## Define handlers

```ts
import type { Handlers } from "@serve-tools/server-webtransport";

interface BoardProtocol {
	requests: { loadBoard(id: string): { title: string } };
	subscriptions: { changes(id: string): { revision: number } };
	datagrams: {
		cursor: {
			client: { x: number; y: number; userID: string };
			server: { x: number; y: number; userID: string };
		};
		inputPacket: { client: Uint8Array };
		presence: { server: { userID: string; active: boolean } };
	};
}

interface Session {
	userID: string;
}

const handlers = {
	requests: {
		loadBoard: (id) => boards.load(id),
	},
	subscriptions: {
		changes: (id, { emit }) => boards.listen(id, emit),
	},
	datagrams: {
		cursor: (cursor, { datagrams }) => datagrams.write("cursor", cursor),
		inputPacket: (packet) => simulation.accept(packet),
	},
} satisfies Handlers<BoardProtocol, Session>;
```

Datagram handlers receive client-to-server kinds only.
Their context includes the connection abort signal, authorization context, and the typed server datagram API.
The server API also provides `write()`, `createWritable(name)`, `subscribe()`, and `read()` with directions reversed from the client.

## Use the Node HTTP/3 adapter

```ts
import { createNodeAdapter } from "@serve-tools/server-webtransport/runtime/node";

const realtime = createNodeAdapter<BoardProtocol, Session>(handlers, {
	authorize(session) {
		const userID = verifyHeaders(session.headers);
		return userID ? { userID } : new Response("Unauthorized", { status: 401 });
	},
});

const server = new HTTPServer().handle(realtime);
```

The adapter requires `serve-tools.realtime.v1` in `WT-Available-Protocols` and selects it through `WT-Protocol` before accepting application data.
Authorization runs during session establishment and its value becomes the typed connection context.
Call `realtime.close()` during shutdown.
The current `@http3-server/server` session API does not expose an application close-code method, so this adapter closes its owned reliable streams but cannot forward the core close code to the native session.

## Build another adapter

`createSession()` accepts separate byte callbacks for reliable operations, the reliable datagram-name registry, and native datagrams.
Forward stream chunks to `receiveOperations()` and `receiveRegistry()`, call their finish methods at end-of-stream, and forward each complete native datagram to `receiveDatagram()`.

The package does not impose a datagram size limit.
It exposes the native maximum when the adapter can observe it, and a native send rejection rejects that write.
Structured datagrams use the shared serializer; binary views bypass it and arrive as `Uint8Array`.
An unknown connection-local datagram kind is dropped because it may legitimately arrive before its reliable registry message.

## Boundaries

Reliable operations are ordered and retransmitted; datagrams are intentionally lossy and suitable only for replaceable state.
The package does not provide retransmission, resumption, persistence, demand signaling, media tracks, MoQ groups, or congestion policy.
Use a separate session and a dedicated MoQ implementation for media delivery.

Protocol declarations do not validate untrusted data.
The deployment owns TLS certificates, HTTP/3 configuration, origin policy, rate limits, authorization, and shutdown of the surrounding server.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-server-webtransport`](./skills/serve-tools-server-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
