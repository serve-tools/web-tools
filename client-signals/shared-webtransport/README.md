# @serve-tools/signal-shared-webtransport

Share one transport client across tabs while each page owns its reactive view of live presence.
Use these three modules in the same directory and compile the TypeScript before opening the page.
The remote endpoint must implement the [`@serve-tools/server-webtransport`](../../server/webtransport/) protocol.

```ts
// protocol.ts
export type PresenceProtocol = { subscriptions: { presence(room: string): { online: number } } };
```

```ts
// presence.worker.ts
import { listen } from "@serve-tools/signal-shared-webtransport/scope/shared-worker";
import type { PresenceProtocol } from "./protocol.js";

listen<PresenceProtocol>("https://example.com/realtime");
```

```ts
// page.ts
import { effect } from "@serve-tools/signal-effect";
import { connect, observe } from "@serve-tools/signal-shared-webtransport";
import type { PresenceProtocol } from "./protocol.js";

const worker = new SharedWorker(new URL("./presence.worker.js", import.meta.url), { type: "module" });
const client = connect<PresenceProtocol>(worker.port);
const presence = observe(client, "presence", { input: "lobby" });
const output = document.createElement("output");
document.body.append(output);
const stop = effect(() => {
	const state = presence.get();
	output.value = state.status === "ready" ? `${state.value.online} online` : state.status === "error" ? `Failed: ${String(state.error)}` : state.status;
});

addEventListener("pagehide", () => {
	stop();
	presence.dispose();
	client.close();
	worker.port.close();
});
```

Open the page in two tabs: each has an independent output and observation, backed by the same named worker and remote connection.
The effect renders the watched state; Signal-aware UI libraries can consume the same observation directly.

This first example owns one active page connection and retires it on `pagehide`.
Cached-page restoration requires a fresh client and observation; follow the [back/forward-cache reconnection recipe](../../client/messaging/#backforward-cache).

## Install

```shell
npm install @serve-tools/signal-shared-webtransport @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalSharedWebtransport from "https://esm.run/@serve-tools/signal-shared-webtransport";
```

Use `listen()` from `/scope/shared-worker`, then import `connect()` and `observe()` together from the package root or `/scope/window`.
Use the raw shared datagram API for best-effort occurrences.
Dispose each observation before closing its page client; neither action closes the worker-owned physical session for other pages.

## Ownership and package choice

The worker owns the physical connection; the page owns its client, observation, and message port.
Closing one page client does not close the connection used by other pages.
Use [`@serve-tools/signal-webtransport`](../webtransport/) for a page-owned connection, or [`@serve-tools/client-shared-webtransport`](../../client/shared-webtransport/) for every subscription occurrence without Signals.
Reliable observations start pending and can become ready, complete, or error.
Datagrams remain best-effort occurrences; use the raw shared datagram API when every arriving occurrence matters.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-shared-webtransport`](./skills/serve-tools-signal-shared-webtransport/SKILL.md).

## License

[MIT-0](./LICENSE.md)
