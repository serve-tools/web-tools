# @serve-tools/signal-shared-websocket

`@serve-tools/signal-shared-websocket` turns one typed subscription from a shared WebSocket page client into explicit, read-only Signal state.
Use it when several tabs or windows share one physical WebSocket through `@serve-tools/client-shared-websocket`, while each UI owns its own reactive view of a subscription.

The package re-exports the `observe()` adapter from `@serve-tools/signal-websocket` with types specialized for `SharedWebSocketClient`.
It adds no independent subscription runtime.

## Install

This example imports all three packages directly:

```shell
npm install @serve-tools/client-shared-websocket @serve-tools/signal-effect @serve-tools/signal-shared-websocket
```

The WebSocket server must implement the binary request-and-subscription protocol used by `@serve-tools/client-websocket`.
These packages provide the browser client and shared-worker bridge, not the server.

## Usage: share live presence across tabs

### 1. Open the WebSocket in a shared worker

Call `listen()` once in the shared worker.
It opens the physical WebSocket and serves the declared protocol to every connected page.
Export the inferred protocol type so the page client stays in sync without duplicating the declaration.

```ts
// presence.worker.ts
import { listen } from "@serve-tools/client-shared-websocket/scope/shared-worker";

export const presenceServer = listen<{
	requests: {
		getRoom(input: { room: string }): { title: string };
	};
	subscriptions: {
		presence(input: { room: string }): { online: number };
		announcements(): string;
	};
}>("wss://example.com/presence");

export type PresenceProtocol = listen.ProtocolType<typeof presenceServer>;
```

Request return types describe responses; subscription return types describe emitted values.
These types are compile-time only, so validate server data at runtime.

### 2. Observe and render presence in the page

Each page connects to the worker, observes the latest presence value, and releases its own resources on `pagehide`.

```html
<output id="presence">Connecting…</output>
<script type="module" src="./presence.js"></script>
```

```ts
// presence.ts
import { connect } from "@serve-tools/client-shared-websocket/scope/window";
import { effect } from "@serve-tools/signal-effect";
import { observe } from "@serve-tools/signal-shared-websocket";
import type { PresenceProtocol } from "./presence.worker.js";

const worker = new SharedWorker(new URL("./presence.worker.js", import.meta.url), {
	name: "presence",
	type: "module",
});
const client = connect<PresenceProtocol>(worker.port);
const presence = observe(client, "presence", { input: { room: "lobby" } });
const output = document.querySelector<HTMLOutputElement>("#presence");

if (!output) {
	throw new Error("Missing #presence output");
}

const stopRendering = effect(() => {
	const state = presence.get();

	switch (state.status) {
		case "pending":
			output.value = "Connecting…";
			break;
		case "ready":
			output.value = `${state.value.online} online`;
			break;
		case "complete":
			output.value = "Presence ended";
			break;
		case "error":
			output.value = `Presence failed: ${String(state.error)}`;
			break;
	}
});

addEventListener(
	"pagehide",
	() => {
		stopRendering();
		presence.dispose();
		client.close();
		worker.port.close();
	},
	{ once: true },
);
```

Same-origin pages that open the same worker URL and name share one worker and one physical WebSocket.
Each page still owns its client, observation, and port.

`effect()` is illustrative; a Signal-aware renderer can read `presence.get()` directly.

## Observation state

`observe()` subscribes immediately and returns an `Observation<Value>`.
Calling `get()` returns one of four states:

```ts
type ObservationState<Value> =
	| { status: "pending" }
	| { status: "ready"; value: Value }
	| { status: "complete" }
	| { status: "error"; error: unknown };
```

- `pending` is the initial state before the first event or terminal outcome.
- `ready` contains the latest subscription event.
- `complete` means the server completed the subscription normally.
- `error` contains a remote, transport, setup, or cancellation failure.

Signal consumers may coalesce intermediate `ready` values.
Use `client.subscribe()` directly when the application must process every event occurrence.

## Inputs and cancellation

For a subscription with one input, put the typed input in the required `input` option:

```ts
const controller = new AbortController();

const presence = observe(client, "presence", {
	input: { room: "lobby" },
	signal: controller.signal,
});
```

For a subscription with no input, omit `input`:

```ts
const announcements = observe(client, "announcements", { signal: controller.signal });
```

Aborting the signal publishes an `error` state containing the signal's reason and cancels the underlying subscription.
Requests remain Promise-based and are sent through `client.request()`; `observe()` is only for subscriptions.

## Ownership and cleanup

The ownership chain is explicit:

- the shared worker owns the physical WebSocket and the server returned by `listen()`;
- each page owns its logical client and `SharedWorker.port`;
- each UI consumer owns the observation returned by `observe()`.

Dispose the UI effect first, then the observation, then the page client, and finally the page's message port.
`presence.dispose()` is idempotent, unsubscribes, and freezes the current observation state.
It does not close the page client, message port, shared worker, or physical WebSocket.

Closing one page client leaves the worker's physical WebSocket available to other pages.
Call `presenceServer.close()` inside the worker only when the application intends to stop all page connections and close the physical WebSocket.

The package does not reconnect, replay events, resume subscriptions, add backpressure, authenticate, or validate server values.
Those policies belong in the application protocol.

## Public API

- `observe(client, name, options?)` eagerly observes one typed shared WebSocket subscription.
- `Observation<Value>` describes the read-only computed Signal and its disposal lifecycle.
- `ObservationState<Value>` describes the `pending`, `ready`, `complete`, and `error` states.
- `ObserveOptions` describes cancellation with an optional `AbortSignal`.
- `Protocol`, `ProtocolType`, `SharedWebSocketClient`, `SubscribeOptions`, and `Subscription` are re-exported types.

## Compatibility

The page requires a modern browser with `SharedWorker`, `MessagePort`, structured clone, and the platform features required by `@serve-tools/signal-websocket`.
The worker requires the platform features used by `@serve-tools/client-shared-websocket`, including `WebSocket` and `Promise.withResolvers()`.
Explicit resource management is optional because observations also expose `dispose()` and clients expose `close()`.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-shared-websocket`](./skills/serve-tools-signal-shared-websocket/SKILL.md).
Install or link that directory into your agent's skill directory when you want package-specific guidance for shared transport ownership, reactive state, and cleanup.

## Development

```shell
npm ci --ignore-scripts
npm run verify
```

The basic public import is compile-checked by [`test/signal-shared-websocket.recipes.ts`](./test/signal-shared-websocket.recipes.ts).

## License

[MIT-0](./LICENSE.md)
