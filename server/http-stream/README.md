# @serve-tools/server-http-stream

`@serve-tools/server-http-stream` turns typed request handlers and live subscriptions into one Fetch-compatible HTTP endpoint.
It pairs with `@serve-tools/client-http-stream` and runs anywhere that accepts a `Request` and returns a `Response`.

## Install

```shell
npm install @serve-tools/server-http-stream
```

#### Import from a CDN

```js
import * as serverHttpStream from "https://esm.run/@serve-tools/server-http-stream";
```

The package root uses web APIs and can run in a browser; hosting a network server requires a server runtime.

## Serve a request and a live subscription

Define operation names and their value types once, then implement the matching handlers.
This complete handler returns a room title and emits a timestamp every second:

```ts
// realtime.ts
import { createHandler, type Handlers } from "@serve-tools/server-http-stream";

export interface RoomProtocol {
	requests: { getRoom(input: { room: string }): { title: string } };
	subscriptions: { clock(): { time: string } };
}

const handlers = {
	requests: { getRoom: ({ room }) => ({ title: `Room: ${room}` }) },
	subscriptions: {
		clock: (_input, { emit }) => {
			const timer = setInterval(() => emit({ time: new Date().toISOString() }), 1_000);
			return () => clearInterval(timer);
		},
	},
} satisfies Handlers<RoomProtocol>;

export const realtime = createHandler(handlers);
export default { fetch: realtime };
```

The example is an unauthenticated local demonstration.
For a Bun server, install the two packages with `npm install @serve-tools/server-http-stream @serve-tools/client-http-stream`, save the example as `realtime.ts`, and run `bun run realtime.ts`.
Bun serves its default-exported Fetch handler at `http://localhost:3000`.
In another Fetch-based host, pass `realtime` to that host's request adapter.
Keep this exported handler alive for the server lifetime; call `realtime.close()` from the host's shutdown hook.

The browser uses the same protocol as a type import:

```ts
import { connect } from "@serve-tools/client-http-stream";
import type { RoomProtocol } from "./realtime.js";

const client = connect<RoomProtocol>("http://localhost:3000");
const room = await client.request("getRoom", { room: "lobby" });
console.log(room.title); // "Room: lobby"

const clock = client.subscribe("clock", ({ time }) => console.log(time));
// Later, when this view closes:
// clock[Symbol.dispose]();
// client.close();
```

Serve the browser application from the same origin, or configure CORS at the host before trying this from a different origin.
See the [HTTP stream client](../../client/http-stream/) for request headers, cancellation, and connection ownership.
The server automatically runs the subscription cleanup when the browser cancels or disconnects.
Add `authorize(request)` when creating the handler to return verified session context or a rejecting `Response`.

The handler accepts `POST` only and requires the Serve Tools vendor media type in both `Content-Type` and `Accept`.
Requests produce one negotiated binary response.
Subscriptions produce a response stream of four-byte-length-prefixed binary protocol messages.
Aborting the HTTP request aborts its handler and runs subscription cleanup.
Subscription responses include no-buffering/no-transform guidance.

Authorization runs before decoding the operation body, and its non-`Response` result becomes the handler connection context.
Authorization, cleanup, formatter, and transport failures that cannot be returned to the client use the runtime's native `reportError()` or `console.error()` when that web API is unavailable.
`maximumMessageLength` defaults to 16 MiB and is enforced while streaming the request body when the runtime exposes it, and always before protocol decoding or handler dispatch.
`maximumBufferedAmount` defaults to 16 MiB and fails a subscription when its framed response queue would exceed that limit.
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
