# @serve-tools/client-shared-websocket

`@serve-tools/client-shared-websocket` provides typed requests and subscriptions over a shared `WebSocket` owned by a `SharedWorker`.
It uses a compact binary protocol with built-in serialization for structured JavaScript values, including cyclic graphs and binary data.

```ts
// project.worker.ts
import { listen } from "@serve-tools/client-shared-websocket/scope/shared-worker";

export const server = listen<{
	requests: {
		openProject: (input: { id: string }) => { id: string; title: string };
		ping: () => void;
	};
	subscriptions: {
		projectChanged: (input: { id: string }) => { revision: number };
	};
}>("wss://example.com/app");

export type ProjectProtocol = listen.ProtocolType<typeof server>;
```

```ts
// app.ts
import { connect } from "@serve-tools/client-shared-websocket/scope/window";
import type { ProjectProtocol } from "./project.worker.js";

const worker = new SharedWorker(new URL("./project.worker.js", import.meta.url), { type: "module" });

using client = connect<ProjectProtocol>(worker.port);

const project = await client.request("openProject", { id: "project-1" });

using changes = client.subscribe("projectChanged", { id: project.id }, (event) => {
	console.log(event.revision);
});
```

## Install

```shell
npm install @serve-tools/client-shared-websocket
```

The WebSocket server must implement the same version of the binary request-and-subscription protocol used by `@serve-tools/client-websocket`.
This package provides the browser client and shared-worker bridge, not the WebSocket server.

## Usage

### Declare a protocol

Declare named request and subscription operations as functions with zero or one input parameter.
A request function's return type is its response, while a subscription function's return type is each emitted event.

```ts
interface ProjectProtocol {
	requests: {
		openProject(input: { id: string }): { id: string; title: string };
		ping(): void;
	};
	subscriptions: {
		projectChanged(input: { id: string }): { revision: number };
	};
}
```

Either `requests` or `subscriptions` may be omitted.
Promise return types are unwrapped for requests, while subscription return types are used as written for emitted events.
The declaration provides compile-time checking only and does not validate values received from the server.

### Own the WebSocket in a shared worker

Import `listen()` from the shared-worker entrypoint.
It opens one physical WebSocket and serves its typed operations to every page connected to that `SharedWorker`.

```ts
// project.worker.ts
import { listen } from "@serve-tools/client-shared-websocket/scope/shared-worker";
import type { ProjectProtocol } from "./project-protocol.js";

export const server = listen<ProjectProtocol>("wss://example.com/app");
```

`listen()` returns immediately while `server.websocket` represents the opening physical connection.
`server.closed` resolves after the shared server and physical WebSocket close.
Handshake subprotocols and cancellation may be passed through the optional `protocols` and `signal` options.

### Connect from each page

Import `connect()` from the window entrypoint and pass the page-owned `SharedWorker.port`.

```ts
// app.ts
import { connect } from "@serve-tools/client-shared-websocket/scope/window";
import type { ProjectProtocol } from "./project-protocol.js";

const worker = new SharedWorker(new URL("./project.worker.js", import.meta.url), {
	name: "projects",
	type: "module",
});
const client = connect<ProjectProtocol>(worker.port);
```

Opening the same named `SharedWorker` from another same-origin page reuses the worker and its physical WebSocket.
Each call to `connect()` still creates a separate logical protocol connection owned by that page.

### Send requests and subscribe

The page client has the same typed request and subscription shape as `@serve-tools/client-websocket`.

```ts
const controller = new AbortController();
const project = await client.request("openProject", { id: "project-1" }, { signal: controller.signal });

using changes = client.subscribe(
	"projectChanged",
	{ id: project.id },
	(event) => console.log(event.revision),
	{
		signal: controller.signal,
		onComplete: () => console.log("complete"),
		onError: (error) => console.error(error),
	},
);
```

Requests may run concurrently and return Promises.
Subscriptions return handles with `active`, `unsubscribe()`, and `[Symbol.dispose]()`, and the listener receives each delivered event.
Use operation-level `AbortSignal` values to cancel work without closing the page client.

## Ownership and lifecycle

The shared worker owns the physical WebSocket and the server returned by `listen()`.
Each page owns its logical client and `SharedWorker.port`, while each subscription consumer owns its subscription handle.

Closing a page client closes only its logical protocol connection to the worker.
It does not close the page's `MessagePort`; call `worker.port.close()` separately when the page no longer needs the port.
Other pages may continue using the worker's physical WebSocket.

Call `server.close()` inside the worker only when the application intends to stop all page connections and close the physical WebSocket.
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
