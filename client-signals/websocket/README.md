# @serve-tools/signal-websocket

`@serve-tools/signal-websocket` observes a typed `@serve-tools/client-websocket` subscription as explicit Signal state.
It reuses the signal messaging observation engine, so the adapter adds no independent subscription runtime.

```ts
import { connect } from "@serve-tools/client-websocket";
import { observe } from "@serve-tools/signal-websocket";

await using client = await connect<{
	subscriptions: {
		presence(room: string): { online: number };
	};
}>("wss://example.com/presence");

using presence = observe(client, "presence", { input: "lobby" });

const state = presence.get();

if (state.status === "ready") {
	console.log(`${state.value.online} online`);
}
```

Finite requests remain Promise-based and are sent through `client.request()`.

## Install

```shell
npm install @serve-tools/client-websocket @serve-tools/signal-websocket
```

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
	input: "lobby",
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
