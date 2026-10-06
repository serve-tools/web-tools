# @serve-tools/server-webtransport

`@serve-tools/server-webtransport` serves reliable typed operations and typed best-effort datagrams over one protocol-owned WebTransport session.
Use reliable requests and subscriptions for board state, and datagrams for replaceable cursor positions.
Its root is a runtime-neutral session core; `runtime/node` adapts `@http3-server/server` callbacks.
WebTransport requires an HTTP/3 deployment; start with the [HTTP stream server](../http-stream/) or [WebSocket server](../websocket/) when your application needs only requests and subscriptions.

## Install

```shell
npm install @serve-tools/server-webtransport @http3-server/server
```

#### Import from a CDN

```js
import * as serverWebtransport from "https://esm.run/@serve-tools/server-webtransport";
```

The package root uses web APIs and can run in a browser; hosting a network server requires a server runtime.

## Send board updates and live cursors

This self-contained demonstration returns a board title, emits a synthetic revision each second, and echoes cursor positions with the session user ID.
Replace the title and revision timer with your application's board store and event source.

```ts
// board.ts
import type { Handlers } from "@serve-tools/server-webtransport";

export interface BoardProtocol {
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

export interface Session {
	userID: string;
}

export const handlers = {
	requests: {
		loadBoard: (id) => ({ title: `Board: ${id}` }),
	},
	subscriptions: {
		changes: (_id, { emit }) => {
			let revision = 0;
			const timer = setInterval(() => emit({ revision: ++revision }), 1_000);
			return () => clearInterval(timer);
		},
	},
	datagrams: {
		cursor: (cursor, { connection, datagrams }) =>
			datagrams.write("cursor", { ...cursor, userID: connection.userID }),
		inputPacket: (packet) => console.log("received input bytes", packet.byteLength),
	},
} satisfies Handlers<BoardProtocol, Session>;
```

Datagram handlers receive client-to-server kinds only.
Their context includes the connection abort signal, authorization context, and the typed server datagram API.
The server API also provides `write()`, `createWritable(name)`, `subscribe()`, and `read()` with directions reversed from the client.

## Use the Node HTTP/3 adapter

Save the handlers above as `board.ts`.
Create the Node adapter in a second module:

```ts
import { createNodeAdapter } from "@serve-tools/server-webtransport/runtime/node";
import { handlers, type BoardProtocol, type Session } from "./board.js";

export const realtime = createNodeAdapter<BoardProtocol, Session>(handlers, {
	authorize() {
		return { userID: "local-demo" };
	},
});
```

This demonstration accepts every session; verify the session's credentials in `authorize(session)` before exposing it outside local development.
Pass `realtime` to your configured `@http3-server/server` instance's `handle()` method.
That host setup supplies TLS certificates, HTTP/3 listening, and origin policy; this snippet only creates the realtime callbacks.
Keep the exported adapter alive for the server lifetime, then call `realtime.close()` during host shutdown.

The adapter requires `serve-tools.realtime.v1` in `WT-Available-Protocols` and selects it through `WT-Protocol` before accepting application data.
Authorization runs during session establishment and its value becomes the typed connection context.
Authorization, datagram callback, cleanup, formatter, and transport failures that cannot be returned to the client use the runtime's native `reportError()` or `console.error()` when that web API is unavailable.
Call `realtime.close()` during shutdown.
Shutdown closes and forgets every owned reliable stream, aborts active operation and datagram handler signals, fails pending datagram registrations and reads, and clears local datagram listeners.
The current `@http3-server/server` session API does not expose an application close-code method, so this adapter closes its owned reliable streams but cannot forward the core close code to the native session.

See the [WebTransport client](../../client/webtransport/) for matching reliable operations and typed datagrams.

## Advanced: build another adapter

`createSession()` accepts separate byte callbacks for reliable operations, the reliable datagram-name registry, and native datagrams.
Forward stream chunks to `receiveOperations()` and `receiveRegistry()`, call their finish methods at end-of-stream, and forward each complete native datagram to `receiveDatagram()`.

The package does not impose a second outgoing datagram size limit or pre-reject a send by size.
It exposes the native maximum when the adapter can observe it, and a native send rejection rejects that write.
Incoming structured binary allocations are bounded by that native maximum, then `maximumMessageLength` when configured, or a 64 KiB fallback.
Structured datagrams use the shared serializer; binary views bypass it and arrive as `Uint8Array`.
An unknown connection-local datagram kind is dropped because it may legitimately arrive before its reliable registry message.
Clean EOF on either reliable protocol stream ends the session and fails pending work.

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
