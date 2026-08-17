# @serve-tools/server-http-stream

`@serve-tools/server-http-stream` creates a type-compatible WHATWG Fetch handler for Serve Tools requests and binary streaming subscriptions.
It pairs with `@serve-tools/client-http-stream` and runs anywhere that accepts a `Request` and returns a `Response`.

## Install

```shell
npm install @serve-tools/server-http-stream
```

## Create a handler

```ts
import { createHandler, type Handlers } from "@serve-tools/server-http-stream";

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

The handler accepts `POST` only and requires the Serve Tools vendor media type in both `Content-Type` and `Accept`.
Requests produce one negotiated binary response.
Subscriptions produce a response stream of four-byte-length-prefixed binary protocol messages.
Aborting the HTTP request aborts its handler and runs subscription cleanup.
Subscription responses include no-buffering/no-transform guidance.

Authorization runs before decoding the operation body, and its non-`Response` result becomes the handler connection context.
Authorization, cleanup, formatter, and transport failures that cannot be returned to the client use the runtime's native `reportError()` or `console.error()` when that web API is unavailable.
`maximumMessageLength` defaults to 16 MiB and is enforced while streaming the request body when the runtime exposes it, and always before protocol decoding or handler dispatch.
Call `close()` or dispose the handler during shutdown to reject new exchanges and close active operations.

Finite operation messages use `application/vnd.serve-tools.realtime.v1`.
Subscription responses use `application/vnd.serve-tools.realtime.v1;framing=length-prefixed`.
An `Accept` entry with `q=0` does not permit either representation.

## Deployment responsibilities

Add CORS and preflight handling in the surrounding HTTP application when clients are cross-origin.
Configure authentication, origin policy, rate limits, any stricter deployment body limits, proxy buffering, compression, keep-alives, and idle timeouts at the appropriate layer.
The package does not provide reconnection, replay, resumption, persistence, or Server-Sent Events semantics.

Protocol types do not validate untrusted inputs.
Validate operation data and authorize sensitive operations in application handlers.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-server-http-stream`](./skills/serve-tools-server-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
