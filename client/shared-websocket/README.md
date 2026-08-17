# @serve-tools/client-shared-websocket

`@serve-tools/client-shared-websocket` provides typed requests and subscriptions over a shared `WebSocket` owned by a `SharedWorker`.
It uses a compact binary protocol with built-in serialization for structured JavaScript values, including cyclic graphs and binary data.

```ts
// presence.worker.ts
import { listen } from "@serve-tools/client-shared-websocket/scope/shared-worker";

export const presenceServer = listen<{
	requests: {
		getRoom(input: { room: string }): { title: string };
	};
	subscriptions: {
		presence(input: { room: string }): { online: number };
	};
}>("wss://example.com/presence");

export type PresenceProtocol = listen.ProtocolType<typeof presenceServer>;
```

```ts
// presence.ts
import { connect } from "@serve-tools/client-shared-websocket/scope/window";
import type { PresenceProtocol } from "./presence.worker.js";

const worker = new SharedWorker(new URL("./presence.worker.js", import.meta.url), { type: "module" });
const client = connect<PresenceProtocol>(worker.port);
const room = await client.request("getRoom", { room: "lobby" });

const presence = client.subscribe("presence", { room: "lobby" }, (event) => {
	console.log(`${room.title}: ${event.online} online`);
});

addEventListener(
	"pagehide",
	() => {
		presence.unsubscribe();
		client.close();
		worker.port.close();
	},
	{ once: true },
);
```

## Install

```shell
npm install @serve-tools/client-shared-websocket
```

Call `listen()` once in the shared worker to open the physical WebSocket, then call `connect()` in each page.
Same-origin pages that open the same worker URL and name share one worker and one physical WebSocket.
Each page still owns its client, subscription, and port.

The WebSocket server must implement the same version of the binary request-and-subscription protocol used by `@serve-tools/client-websocket`.
This package provides the browser client and shared-worker bridge, not the WebSocket server.

Request return types describe responses; subscription return types describe emitted values.
These types are compile-time only, so validate server data at runtime.

The page client supports the same typed requests, subscriptions, and operation-level cancellation as `@serve-tools/client-websocket`.

## Protocol and operations

Either `requests` or `subscriptions` may be omitted from a protocol.
Promise return types are unwrapped for requests, while subscription return types describe each emitted value as written.

Requests may run concurrently and return Promises.
Subscriptions return handles with `active`, `unsubscribe()`, and `[Symbol.dispose]()`, and the listener receives every delivered event.
Use operation-level `AbortSignal` values to cancel work without closing the page client.

`listen()` returns immediately while `presenceServer.websocket` represents the opening physical connection.
Its optional signal cancels the handshake or closes the established shared server and physical WebSocket if it aborts later.
`presenceServer.closed` resolves after the shared server and physical WebSocket close.

## Ownership and lifecycle

The shared worker owns the physical WebSocket and the server returned by `listen()`.
Each page owns its logical client and `SharedWorker.port`, while each subscription consumer owns its subscription handle.

Closing a page client closes only its logical protocol connection to the worker.
It does not close the page's `MessagePort`; call `worker.port.close()` separately when the page no longer needs the port.
Other pages may continue using the worker's physical WebSocket.

Call `presenceServer.close()` inside the worker only when the application intends to stop all page connections and close the physical WebSocket.
The worker also closes its server when the WebSocket closes, and worker termination ends the entire shared resource.

Values cross the page-worker boundary through structured clone before the WebSocket package serializes them.
The package does not reconnect, replay requests, resume subscriptions, authenticate, validate server values, or add backpressure.
Those policies belong in the application protocol.

## Public API

- `@serve-tools/client-shared-websocket/scope/window` exports `connect<P>(port)`, `RemoteError`, and the page-client types.
- `@serve-tools/client-shared-websocket/scope/shared-worker` exports `listen<P>(url, options?)` and the worker-server types.
- The root entrypoint exports `RemoteError` and shared types for APIs that do not need a scope-specific runtime function.
- `SharedWebSocketClient<P>` provides typed `request()`, `subscribe()`, `closed`, and `close()` operations for one page connection.
- `SharedWebSocketServer<P>` provides the physical `websocket` Promise, `closed`, `close()`, and `[Symbol.dispose]()`.
- `ProtocolType<Value>` extracts the protocol retained by a shared client, server, or pending resource.

## Trust boundary

Protocol declarations are compile-time contracts, not runtime validation.
Validate untrusted response and event values before using them in security-sensitive code.

Transport security, authentication, authorization, origin policy, SharedWorker naming, and native WebSocket subprotocol negotiation remain application responsibilities.
Use `wss:` for network connections that require transport encryption.

## Compatibility

The page requires a modern browser with `SharedWorker`, `MessagePort`, structured clone, and `Promise.withResolvers()`.
The shared worker additionally requires `WebSocket`, `ArrayBuffer`, `TextEncoder`, `TextDecoder`, and `reportError()`.
Explicit resource management requires native or transpiled `using` support and a `Symbol.dispose` implementation; `close()` and `unsubscribe()` are always available.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-shared-websocket`](./skills/serve-tools-client-shared-websocket/SKILL.md).
Install or link that directory into your agent's skill directory when you want package-specific guidance for worker ownership, page connections, cancellation, and cleanup.

## Development

```shell
npm ci --ignore-scripts
npm run verify
npm run benchmark --workspace @serve-tools/client-shared-websocket
```

Core worker and page usage is compile-checked by [`test/client-shared-websocket.recipes.ts`](./test/client-shared-websocket.recipes.ts).

## License

[MIT-0](./LICENSE.md)
