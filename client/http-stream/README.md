# @serve-tools/client-http-stream

Make typed requests and receive live subscription events over HTTP.
`@serve-tools/client-http-stream` handles binary serialization, cancellation, author headers, and protocol response checks.

```ts
import { connect } from "@serve-tools/client-http-stream";

const client = connect<{
	requests: {
		getRoom(input: { room: string }): { title: string };
	};
	subscriptions: {
		presence(input: { room: string }): { online: number };
	};
}>("https://example.com/realtime");

addEventListener("pagehide", (event) => {
	if (!event.persisted) client.close();
});

const room = await client.request("getRoom", { room: "lobby" });

const presence = client.subscribe("presence", { room: "lobby" }, (event) => {
	console.log(room.title, event.online);
	//               ^? string
	//                            ^? number
});
```

Request a room and observe its live presence through one typed application contract.
The URL must run the matching [HTTP stream server](../../server/http-stream/); a normal JSON endpoint does not speak this binary protocol.
A presence value of `{ online: 3 }` logs the returned room title and `3`.
The page keeps receiving events until a terminal `pagehide` releases its subscription and client.
Next, add author headers or an operation-level `AbortSignal` to cancel just one request.
Use [Shared HTTP Stream](../shared-http-stream/) to coordinate calls through one worker, or [WebSocket](../websocket/) for a socket transport.

## Install

```shell
npm install @serve-tools/client-http-stream
```

#### Import from a CDN

```js
import * as clientHttpStream from "https://esm.run/@serve-tools/client-http-stream";
```

Use `@serve-tools/server-http-stream` for the matching Fetch handler.

Each request or subscription is one `POST` exchange.
Finite requests receive one binary protocol message; subscriptions consume a response stream of length-prefixed binary messages.
The package sets its required `Accept` and `Content-Type` fields after author headers so the application protocol cannot be accidentally disabled.

Optional `headers` may be a `HeadersInit` value or an async provider called for each operation.
Other standard `RequestInit` fields pass through to Fetch.
Set the positive `maximumMessageLength` option when the server's response limit differs from the 16 MiB default.
The client applies it to finite response bytes, subscription frame payloads, and declared resizable-buffer capacity before allocation.
The connection signal closes all exchanges, while operation signals cancel one request or subscription.
Ending a subscription response before a protocol `complete`, `reject`, or `close` settlement reports a protocol error.

## Negotiation and deployment

Request bodies and finite responses use `application/vnd.serve-tools.realtime.v1`.
Subscription responses use `application/vnd.serve-tools.realtime.v1;framing=length-prefixed` so the representation declares its record framing once while each four-byte prefix delimits one message.
The client sends an operation-specific `Accept` field and requires the server to select that exact representation.

Cross-origin auth headers normally trigger a CORS preflight.
Configure CORS, credentials, cookies, caching, compression, proxy buffering, and idle timeouts in the application and deployment layer.
The client can send `Authorization` and any other CORS-permitted author header.

An HTTP subscription response is server-to-client streaming, not a bidirectional session.
Client operations are separate POST bodies, and this package does not reconnect, replay, resume subscriptions, persist events, or implement Server-Sent Events.

## Public API

`connect<P>()` returns `Client<P>` with `request()`, `subscribe()`, `closed`, and `close()`.
Its options include Fetch initialization, author headers, connection lifetime signal, custom Fetch implementation, and `maximumMessageLength`.
`RemoteError`, protocol extraction, request options, subscription options, and subscription handle types are also exported.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-http-stream`](./skills/serve-tools-client-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
