# @serve-tools/client-sse

`@serve-tools/client-sse` provides typed requests and subscriptions over [Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html), with support for abort signals, headers, request bodies, and precise response validation.

## Install

```shell
npm install @serve-tools/client-sse
```

Use `@serve-tools/server-sse` for the matching Fetch handler.

## Connect

```ts
import { connect } from "@serve-tools/client-sse";

interface Protocol {
	requests: {
		getRoom(input: { room: string }): { title: string };
	};
	subscriptions: {
		presence(input: { room: string }): { online: number };
	};
}

using client = connect<Protocol>("https://example.com/realtime", {
	headers: async ({ kind, name }) => ({
		Authorization: `Bearer ${await accessToken()}`,
		"X-Operation": `${kind}:${name}`,
	}),
});

const room = await client.request("getRoom", { room: "lobby" });

using presence = client.subscribe("presence", { room: "lobby" }, (event) => {
	console.log(room.title, event.online);
});
```

Each request or subscription is one `POST` exchange.
Finite requests accept the negotiated binary media type; subscriptions consume a streaming event-stream response.
The package sets its required `Accept` and `Content-Type` fields after author headers so the application protocol cannot be accidentally disabled.

`headers` may be a `HeadersInit` value or an async provider called for each operation.
Other standard `RequestInit` fields pass through to Fetch.
The connection signal closes all exchanges, while operation signals cancel one request or subscription.
Ending a subscription response before a protocol `complete`, `reject`, or `close` settlement reports a protocol error.

## Negotiation and deployment

The client sends `application/octet-stream;protocol=serve-tools.realtime.v1` and requires the server to select the same protocol parameter.
Subscriptions use `text/event-stream;protocol=serve-tools.realtime.v1` in `Accept` and the response `Content-Type`.

Cross-origin auth headers normally trigger a CORS preflight.
Configure CORS, credentials, cookies, caching, compression, proxy buffering, and idle timeouts in the application and deployment layer.
Unlike native `EventSource`, this client can send `Authorization` and any other CORS-permitted author header.

SSE is server-to-client streaming, not a bidirectional session.
Client operations are separate POST bodies, and this package does not reconnect, replay `Last-Event-ID`, resume subscriptions, or persist events.

## Public API

`connect<P>()` returns `Client<P>` with `request()`, `subscribe()`, `closed`, and `close()`.
`RemoteError`, protocol extraction, request options, subscription options, and subscription handle types are also exported.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-sse`](./skills/serve-tools-client-sse/SKILL.md).

## License

[MIT-0](./LICENSE.md)
