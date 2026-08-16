# @serve-tools/server-websocket

`@serve-tools/server-websocket` serves typed requests and subscriptions over the same binary structured-data protocol as `@serve-tools/client-websocket`.
Its root export is runtime-neutral: a sans-I/O connection core plus an adapter for accepted WHATWG-compatible WebSockets.
Focused adapters integrate Node.js with `ws`, Bun, and crossws-based frameworks.

## Install

```shell
npm install @serve-tools/server-websocket
```

Install the optional integration used by your server:

```shell
npm install ws       # Node.js adapter
npm install crossws  # crossws, Nitro, Nuxt, or h3 hooks
```

Deno and Bun adapters require no package peer.

## Define handlers

Handlers mirror the client protocol declaration.
Requests return one value.
Subscriptions emit repeated values and may return a synchronous or asynchronous cleanup function.

```ts
import type { Handlers } from "@serve-tools/server-websocket";

interface RoomProtocol {
	requests: {
		getRoom(input: { id: string }): { title: string };
	};
	subscriptions: {
		presence(input: { id: string }): { online: number };
	};
}

interface Session {
	userID: string;
}

const handlers = {
	requests: {
		getRoom: ({ id }, { connection }) => ({ title: `${connection.userID}:${id}` }),
	},
	subscriptions: {
		presence: (_input, { emit, signal }) => {
			const timer = setInterval(() => emit({ online: 1 }), 1_000);
			signal.addEventListener("abort", () => clearInterval(timer), { once: true });

			return () => clearInterval(timer);
		},
	},
} satisfies Handlers<RoomProtocol, Session>;
```

The operation `signal` aborts when the client cancels or when the operation or connection finishes.
Subscription cleanup runs at most once, including when cancellation arrives before an asynchronous handler returns its cleanup.

## Accept a WHATWG WebSocket

Use `attach()` after the runtime accepts an upgrade.
For Deno:

```ts
import { attach } from "@serve-tools/server-websocket";

Deno.serve((request) => {
	const { socket, response } = Deno.upgradeWebSocket(request);
	attach<RoomProtocol, Session>(socket, handlers, { userID: "verified-user" });

	return response;
});
```

The supplied WebSocket is owned by the connection until it closes.
Do not send unrelated frames over it.

## Accept Node.js upgrades

The Node.js adapter is a `node:http` upgrade listener backed by the optional `ws` peer.
Authorization runs before the WebSocket handshake, and its successful return value becomes the typed connection context.

```ts
import { createServer } from "node:http";
import { handleUpgrade } from "@serve-tools/server-websocket/scope/node";

const server = createServer();
const upgrades = handleUpgrade<RoomProtocol, Session>(handlers, {
	authorize(request) {
		const userID = request.headers["x-user-id"];

		return typeof userID === "string"
			? { userID }
			: new Response("Unauthorized", { status: 401 });
	},
});

server.on("upgrade", upgrades);
server.listen(8080);
```

Call `upgrades.close()` during shutdown to close accepted protocol connections and reject new upgrades.
Remove the listener and close the HTTP server according to the surrounding server's ownership model.

## Serve with Bun

`createBunAdapter()` returns the `fetch` upgrade function and WebSocket callbacks expected by `Bun.serve()`.

```ts
import { createBunAdapter } from "@serve-tools/server-websocket/scope/bun";

const adapter = createBunAdapter<RoomProtocol, Session>(handlers, {
	authorize: () => ({ userID: "verified-user" }),
});

const server = Bun.serve({
	websocket: adapter.websocket,
	fetch: (request, server) => adapter.upgrade(request, server),
});
```

Call `adapter.close()` before stopping the Bun server.

## Integrate crossws

`createHooks()` returns crossws lifecycle hooks suitable for crossws and frameworks built on it, including Nitro, Nuxt, and h3.

```ts
import { createHooks } from "@serve-tools/server-websocket/crossws";

export default createHooks<RoomProtocol, Session>(handlers, {
	authorize: () => ({ userID: "verified-user" }),
});
```

Framework registration differs, but the returned `upgrade`, `open`, `message`, `close`, and `error` hooks retain their crossws meanings.
Call `closeConnections()` when the integration shuts down.

## Build a custom adapter

`createConnection()` is the sans-I/O core.
Give it byte output and physical-close callbacks, then forward each complete binary message to `receive()`.

```ts
import { createConnection } from "@serve-tools/server-websocket";

const connection = createConnection<RoomProtocol, Session>(
	handlers,
	{
		send: (payload) => transport.send(payload),
		close: (code, reason) => transport.close(code, reason),
	},
	{ userID: "verified-user" },
);

transport.onMessage((payload) => connection.receive(payload));
transport.onClose((reason) => connection.disconnect(reason));
```

The core expects one complete protocol message per `receive()` call.
For reliable byte streams such as WebTransport streams, combine it with `FrameDecoder` and `encodeFrame` from `@serve-tools/realtime-protocol/stream`.
Datagrams are not a safe substitution because request and subscription settlement depends on reliable ordered delivery.

## Errors, limits, and trust

The server defaults to 16 MiB per incoming message, 16 MiB in an observable transport send queue, and 1,024 concurrent operations per connection.
Set lower `maximumMessageLength`, `maximumBufferedAmount`, and `maximumOperations` values when your application can.
The Node adapter also applies the message limit in `ws` before protocol decoding.
WHATWG, Bun, and crossws adapters observe their send queues and close a connection that exceeds its configured bound instead of allowing unbounded buffering.

Handler failures are returned as stack-redacted `{ name, message }` records by default.
Use `formatError()` only to expose errors intentionally, and never leak credentials, internal paths, or sensitive database details.
Use `reportError()` to observe cleanup, formatter, or transport failures that can no longer be sent to the client.

Protocol types do not validate untrusted request inputs.
Authenticate during the upgrade, authorize every operation that needs finer access control, validate inputs at runtime, enforce origin policy where appropriate, and use TLS in production.

The package bounds observable transport buffering but does not add demand signaling or pause and resume application producers.
It does not implement retry, session resumption, or persisted delivery.
When producers can outpace clients, make flow control part of the application protocol.

## Public API

The root export provides `createConnection()`, `attach()`, `defaultErrorRecord()`, and their handler, connection, context, transport, protocol, and option types.

Focused exports provide:

- `@serve-tools/server-websocket/scope/node`: `handleUpgrade()` and Node adapter types;
- `@serve-tools/server-websocket/scope/bun`: `createBunAdapter()` and Bun adapter types;
- `@serve-tools/server-websocket/crossws`: `createHooks()` and crossws adapter types.

## Compatibility

The sans-I/O core requires modern JavaScript with `AbortController`, `ArrayBuffer`, `Promise.withResolvers()`, and explicit resource management symbols.
`attach()` requires an accepted WHATWG-compatible WebSocket.
The runtime adapters are conformance-tested with Node.js and `ws`, Bun, and Deno; crossws hooks are tested against its public integration types.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-server-websocket`](./skills/serve-tools-server-websocket/SKILL.md).
Install or link that directory when an agent needs handler, authorization, adapter, shutdown, or custom-transport guidance.

## Development

```shell
npm ci --ignore-scripts
npm run verify
```

The public root recipe is compile-checked in [`test/server-websocket.recipes.ts`](./test/server-websocket.recipes.ts).
Bun and Deno runtime conformance can be run with the package's `test:bun` and `test:deno` scripts.

## License

[MIT-0](./LICENSE.md)
