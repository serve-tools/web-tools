# @serve-tools/client-webtransport

`@serve-tools/client-webtransport` combines reliable typed requests and subscriptions with typed best-effort datagrams on one protocol-owned WebTransport session.
It uses WebTransport directly and does not implement or share a session with Media over QUIC.

## Install

```shell
npm install @serve-tools/client-webtransport
```

Use `@serve-tools/server-webtransport` for the matching server.

## Use reliable operations and datagrams

```ts
import { connect } from "@serve-tools/client-webtransport";

interface BoardProtocol {
	requests: {
		loadBoard(id: string): { title: string };
	};
	subscriptions: {
		changes(id: string): { revision: number };
	};
	datagrams: {
		cursor: {
			client: { x: number; y: number; userID: string };
			server: { x: number; y: number; userID: string };
		};
		inputPacket: { client: Uint8Array };
		presence: { server: { userID: string; active: boolean } };
	};
}

await using client = await connect<BoardProtocol>("https://example.com/realtime");

const board = await client.request("loadBoard", "lobby");
using changes = client.subscribe("changes", "lobby", renderChange);

await client.datagrams.write("cursor", { x: 20, y: 40, userID: "ada" });
await client.datagrams.write("inputPacket", nativePacket);

using presence = client.datagrams.subscribe("presence", renderPresence);
const nextCursor = await client.datagrams.read("cursor", { signal });

const cursor = client.datagrams.createWritable("cursor", { sendOrder: 10 });
const cursorWriter = cursor.getWriter();
await cursorWriter.write({ x: 24, y: 42, userID: "ada" });
```

`write()` reuses a shared native writer.
`createWritable(name)` provides an independently scheduled writable for applications that need separate send groups or ordering.
`subscribe()` observes future arrivals without replay or buffering; `read()` waits for exactly the next arrival.

Datagrams are always named and typed within a session owned by this package.
Names are registered once over a reliable control stream and then represented by compact connection-local integers.
Structured values use the shared serializer.
`ArrayBuffer` and `ArrayBufferView` values bypass serialization and are received as `Uint8Array`, while still carrying the small typed-datagram envelope.
The package exposes the native `maxDatagramSize` but does not impose a second size limit or pre-reject a write.

## Transport semantics

Requests, subscription events, cancellation, and settlement use a framed reliable bidirectional stream.
They are ordered and retransmitted by QUIC; slow delivery may still make an application frame obsolete, so cancel or supersede obsolete work at the application layer.

Datagrams are unreliable by design: they may be lost and are not retransmitted or flow-controlled like a reliable stream.
Use them for replaceable recent state such as cursors, presence position, control input, telemetry samples, and transient simulation state.
Do not use them for authoritative mutations, required acknowledgements, or ordinary media transport.

The session negotiates `serve-tools.realtime.v1` through WebTransport's native `WT-Available-Protocols` and `WT-Protocol` mechanism.
The package owns its operation stream, registry stream, and datagrams; create a separate WebTransport session for MoQ or another application protocol.
Datagrams whose connection-local kind arrives before its reliable registration are dropped, because datagram and stream ordering is intentionally independent.

## Public API

`connect<P>()` resolves to a client with `request()`, `subscribe()`, `closed`, `close()`, and the typed `datagrams` API.
Receive-side adapter controls remain internal.
The optional connection signal cancels setup and closes an established client when later aborted.

## Boundaries

The client does not reconnect, resume, persist, retransmit datagrams, provide datagram history, or implement MoQ tracks and groups.
Protocol declarations are compile-time contracts rather than runtime validation.
WebTransport deployment requires HTTPS, HTTP/3 support, certificate configuration, and server routing outside this package.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-webtransport`](./skills/serve-tools-client-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
