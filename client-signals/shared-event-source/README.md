# @serve-tools/signal-shared-event-source

Share one EventSource connection across tabs while each page owns its reactive view of live presence.
Use these three modules in the same directory and compile the TypeScript before opening the page.
The remote endpoint must send named presence events with JSON data over native server-sent events.

```ts
// protocol.ts
export type PresenceProtocol = { presence: { online: number } };
```

```ts
// presence.worker.ts
import { listen } from "@serve-tools/signal-shared-event-source/scope/shared-worker";
import type { PresenceProtocol } from "./protocol.js";

listen<PresenceProtocol>("https://example.com/events");
```

```ts
// page.ts
import { effect } from "@serve-tools/signal-effect";
import { connect, observe } from "@serve-tools/signal-shared-event-source";
import type { PresenceProtocol } from "./protocol.js";

const worker = new SharedWorker(new URL("./presence.worker.js", import.meta.url), { type: "module" });
const client = connect<PresenceProtocol>(worker.port);
const presence = observe(client, "presence");
const output = document.createElement("output");
document.body.append(output);
const stop = effect(() => {
	const state = presence.get();
	output.value = state.status === "ready" ? `${state.event.data.online} online` : "Waiting for presence…";
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
npm install @serve-tools/signal-shared-event-source @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalSharedEventSource from "https://esm.run/@serve-tools/signal-shared-event-source";
```

Use `@serve-tools/signal-shared-event-source/scope/shared-worker` for `listen()` and the package root or `/scope/window` for `connect()` and `observe()`.
The complete event record remains page-owned Signal state, including `lastEventId`.
Use the underlying shared client subscription when every event occurrence matters.

## Ownership and package choice

The worker owns the physical connection; the page owns its client, observation, and message port.
Closing one page client does not close the connection used by other pages.
Use [`@serve-tools/signal-event-source`](../event-source/) for a page-owned connection, or [`@serve-tools/client-shared-event-source`](../../client/shared-event-source/) for every subscription occurrence without Signals.
The observation retains the latest complete event record, including lastEventId, and starts in pending state.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-shared-event-source`](./skills/serve-tools-signal-shared-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
