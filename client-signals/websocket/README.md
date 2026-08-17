# @serve-tools/signal-websocket

`@serve-tools/signal-websocket` provides the typed WebSocket client together with explicit subscription Signal state.
It reuses the signal messaging observation engine, so the adapter adds no independent subscription runtime.

## Install

```shell
npm install @serve-tools/signal-effect @serve-tools/signal-websocket
```

The signal package re-exports the complete `@serve-tools/client-websocket` API unchanged.
The WebSocket server must implement the binary request-and-subscription protocol used by `@serve-tools/client-websocket`.

## Usage: render live presence

The page opens its own WebSocket, observes the latest presence value, and releases its resources on `pagehide`.

```html
<output id="presence">Connecting…</output>
<script type="module" src="./presence.js"></script>
```

```ts
// presence.ts
import { effect } from "@serve-tools/signal-effect";
import { connect, observe } from "@serve-tools/signal-websocket";

const client = await connect<{
	subscriptions: {
		presence(input: { room: string }): { online: number };
		announcements(): string;
	};
}>("wss://example.com/presence");
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
	},
	{ once: true },
);
```

Each page that runs this code owns a separate physical WebSocket.
Use `@serve-tools/signal-shared-websocket` when pages should share one connection through a `SharedWorker`.

`effect()` is illustrative; a Signal-aware renderer can read `presence.get()` directly.
Finite requests remain Promise-based and are sent through `client.request()`.

## Observation state

`observe()` subscribes eagerly and returns a read-only computed `Observation<Value>`.
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

## Typed inputs and cancellation

For a subscription with one input, put the typed input in the required `input` option:

```ts
const controller = new AbortController();
const presence = observe(client, "presence", {
	input: { room: "lobby" },
	signal: controller.signal,
});
```

For a zero-input subscription, omit `input`:

```ts
const announcements = observe(client, "announcements", { signal: controller.signal });
```

Aborting the signal publishes an `error` state containing the signal's reason and cancels the underlying subscription.
An already-aborted signal produces that error state without opening a subscription.

Subscription return types are observed as written and are not Promise-unwrapped.
Protocol declarations constrain client code at compile time but do not validate server values at runtime.

## Lifecycle

An observation owns exactly one WebSocket subscription and exposes whether it remains `active`.
Call `dispose()` or use explicit resource management to unsubscribe.
Disposal is idempotent and freezes the current state rather than publishing another state.

The observation does not own or close its WebSocket client.
Dispose observations before closing the client that created them.

## Public API

- The complete `@serve-tools/client-websocket` API is re-exported, including `connect()`.
- `observe(client, name, options?)` eagerly observes one typed WebSocket subscription.
- `Observation<Value>` describes the read-only computed Signal and its disposal lifecycle.
- `ObservationState<Value>` describes the `pending`, `ready`, `complete`, and `error` states.
- `ObserveOptions` describes cancellation with an optional `AbortSignal`.

## Compatibility

The package is an ES module for browser environments supported by `@serve-tools/client-websocket` and `@serve-tools/signal-messaging`.
It requires the platform features used by the WebSocket client, including `WebSocket` and `Promise.withResolvers()`.
Explicit resource management requires `Symbol.dispose` support or a compatible polyfill; `dispose()` is always available.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-websocket`](./skills/serve-tools-signal-websocket/SKILL.md).
Install or link that directory into your agent's skill directory when you want package-specific guidance for state handling, cancellation, and choosing state observation versus occurrence processing.

## Development

```shell
npm ci --ignore-scripts
npm run verify
npm run benchmark --workspace @serve-tools/signal-websocket
```

Core usage is compile-checked by [`test/signal-websocket.recipes.ts`](./test/signal-websocket.recipes.ts).

## License

[MIT-0](./LICENSE.md)
