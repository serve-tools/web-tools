# @serve-tools/signal-webtransport

Show live presence from a reliable WebTransport subscription with one observation and one reactive render function.
Use a matching [`@serve-tools/server-webtransport`](../../server/webtransport/) endpoint in a browser with WebTransport support.

```ts
import { effect } from "@serve-tools/signal-effect";
import { connect, observe } from "@serve-tools/signal-webtransport";

const client = await connect<{
	subscriptions: { presence(room: string): { online: number } };
}>("https://example.com/realtime");
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
npm install @serve-tools/signal-webtransport @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalWebtransport from "https://esm.run/@serve-tools/signal-webtransport";
```

The package re-exports the complete `@serve-tools/client-webtransport` API unchanged.
The adapter applies to reliable subscriptions, not best-effort datagrams.
Use the client's datagram API when every arriving datagram occurrence matters.
Dispose observations independently from the WebTransport client.

## Choose a transport and observation model

Use [`@serve-tools/client-webtransport`](../../client/webtransport/) for finite requests and every subscription occurrence.
Use this adapter for the latest reliable subscription state in a view.
Use [`@serve-tools/signal-shared-webtransport`](../shared-webtransport/) when multiple tabs should share the worker-owned connection.
WebTransport datagrams are best-effort occurrences and use the client datagram API directly; they are not converted into reliable Signal observations.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-webtransport`](./skills/serve-tools-signal-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
