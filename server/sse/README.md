# @serve-tools/server-sse

`@serve-tools/server-sse` creates a type-compatible WHATWG Fetch handler for Serve Tools requests and server-sent subscriptions.
It pairs with `@serve-tools/client-sse` and runs anywhere that accepts a `Request` and returns a `Response`.

## Install

```shell
npm install @serve-tools/server-sse
```

## Create a handler

```ts
import { createHandler, type Handlers } from "@serve-tools/server-sse";

interface Protocol {
	requests: { identity(): string };
	subscriptions: { presence(room: string): { online: number } };
}

interface Session {
	userID: string;
}

const handlers = {
	requests: {
		identity: (_input, { connection }) => connection.userID,
	},
	subscriptions: {
		presence: (room, { emit, signal }) => {
			const off = presence.listen(room, emit);
			signal.addEventListener("abort", off, { once: true });
			return off;
		},
	},
} satisfies Handlers<Protocol, Session>;

using realtime = createHandler(handlers, {
	authorize(request) {
		const userID = verifyBearer(request.headers.get("authorization"));
		return userID ? { userID } : new Response("Unauthorized", { status: 401 });
	},
});

export default { fetch: realtime };
```

The handler accepts `POST` only and verifies the protocol parameter in both `Content-Type` and `Accept`.
Requests produce one negotiated binary response.
Subscriptions produce a standards-compatible event stream whose data fields carry binary protocol messages as base64.
Aborting the HTTP request aborts its handler and runs subscription cleanup.
Subscription responses include no-buffering/no-transform guidance and send a comment keepalive every 60 seconds by default.
Set `keepAliveInterval` to another interval or `false` when the deployment owns keepalives.

Authorization runs before decoding the operation body, and its non-`Response` result becomes the handler connection context.
Call `close()` or dispose the handler during shutdown to reject new exchanges and close active operations.

## Deployment responsibilities

Add CORS and preflight handling in the surrounding HTTP application when clients are cross-origin.
Configure authentication, origin policy, rate limits, body limits, proxy buffering, compression, keep-alives, and idle timeouts at the appropriate layer.
The package does not emulate EventSource reconnection, event replay, resumption, or persistence.

Protocol types do not validate untrusted inputs.
Validate operation data and authorize sensitive operations in application handlers.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-server-sse`](./skills/serve-tools-server-sse/SKILL.md).

## License

[MIT-0](./LICENSE.md)
