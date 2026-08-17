# @serve-tools/client-http-stream

`@serve-tools/client-http-stream` provides typed binary requests and streaming subscriptions over HTTP, with support for abort signals, author headers, and precise response validation.

```ts
import { connect } from "@serve-tools/client-http-stream";

using client = connect<{
	requests: {
		getRoom(input: { room: string }): { title: string };
	};
	subscriptions: {
		presence(input: { room: string }): { online: number };
	};
}>("https://example.com/realtime");

const room = await client.request("getRoom", { room: "lobby" });
//    ^? { title: string }

using presence = client.subscribe("presence", { room: "lobby" }, (event) => {
	console.log(room.title, event.online);
	//          ^? { title: string }
	//                      ^? { online: number }
});
```

## Install

```shell
npm install @serve-tools/client-http-stream
```

Use `@serve-tools/server-http-stream` for the matching Fetch handler.

Each request or subscription is one `POST` exchange.
Finite requests receive one binary protocol message; subscriptions consume a response stream of length-prefixed binary messages.
The package sets its required `Accept` and `Content-Type` fields after author headers so the application protocol cannot be accidentally disabled.

Optional `headers` may be a `HeadersInit` value or an async provider called for each operation.
Other standard `RequestInit` fields pass through to Fetch.
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
`RemoteError`, protocol extraction, request options, subscription options, and subscription handle types are also exported.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-http-stream`](./skills/serve-tools-client-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
