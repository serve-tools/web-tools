# @serve-tools/signal-http-stream

Show live presence from a HTTP subscription with one observation and one reactive render function.
Use a matching [`@serve-tools/server-http-stream`](../../server/http-stream/) endpoint; an arbitrary HTTP response is not this protocol.

```ts
import { effect } from "@serve-tools/signal-effect";
import { connect, observe } from "@serve-tools/signal-http-stream";

const client = connect<{
	subscriptions: { presence(room: string): { online: number } };
}>("/realtime");
const presence = observe(client, "presence", { input: "lobby" });
const output = document.createElement("output");
document.body.append(output);
const stop = effect(() => {
	const state = presence.get();
	output.value = state.status === "ready" ? `${state.value.online} online`
		: state.status === "error" ? `Failed: ${String(state.error)}` : state.status;
});

addEventListener("pagehide", (event) => {
	if (event.persisted) return;

	stop();
	presence.dispose();
	client.close();
});
```

The output follows `pending`, `ready`, `complete`, and `error` without a separate application state object.
The effect renders the watched state; Signal-aware UI libraries can consume the same observation directly.

## Install

```shell
npm install @serve-tools/signal-http-stream @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalHttpStream from "https://esm.run/@serve-tools/signal-http-stream";
```

The package re-exports the complete `@serve-tools/client-http-stream` API unchanged.
`observe()` subscribes eagerly and returns `pending`, `ready`, `complete`, or `error` state.
Dispose the observation independently from the HTTP client.
Use `client.subscribe()` directly when every event occurrence matters.

## Choose a transport and observation model

Use [`@serve-tools/client-http-stream`](../../client/http-stream/) for finite requests and every subscription occurrence.
Use this adapter for the latest reliable subscription state in a view.
Use [`@serve-tools/signal-shared-http-stream`](../shared-http-stream/) when multiple tabs should share the worker-owned connection.
HTTP streaming supports finite requests and server-to-client subscriptions; it does not add a persistent bidirectional session, reconnection, or replay.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-http-stream`](./skills/serve-tools-signal-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
