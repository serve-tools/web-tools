# @serve-tools/client-shared-http-stream

Make typed HTTP requests and observe live subscriptions from several tabs through one SharedWorker coordinator.

```ts
// realtime.worker.ts
import { listen } from "@serve-tools/client-shared-http-stream/scope/shared-worker";

export const realtime = listen<{
	requests: { getRoom(room: string): { title: string } };
	subscriptions: { presence(room: string): { online: number } };
}>("https://example.com/realtime");

export type RealtimeProtocol = listen.ProtocolType<typeof realtime>;
```

```ts
// page.ts
import { connect } from "@serve-tools/client-shared-http-stream/scope/window";
import type { RealtimeProtocol } from "./realtime.worker.js";

const worker = new SharedWorker(new URL("./realtime.worker.js", import.meta.url), { type: "module" });
const client = connect<RealtimeProtocol>(worker.port);
const presence = client.subscribe("presence", "lobby", console.log);

addEventListener("pagehide", () => {
	presence.unsubscribe();
	client.close();
	worker.port.close();
});
```

Run the worker setup once, then run the page code in two same-origin tabs using the same worker URL and name.
Both tabs use one worker coordinator for requests and streaming subscriptions; each tab retains its own client and subscription.
The example's presence event carries an online count and is printed by each interested page.
The remote endpoint must implement the matching transport protocol; declared TypeScript types do not validate incoming values.

Next, request a room through the same client while a presence subscription remains active.
Use the [direct client](../http-stream/) when each page should own its connection.
Closing a page client leaves other tabs active; the page owner must also close its `MessagePort` when finished.

The page connection closes on every `pagehide`, including when entering the back/forward cache.
On a persisted `pageshow`, create a fresh worker port, client, and subscriptions using the [mount and restore recipe](../messaging/#backforward-cache).

## Install

```shell
npm install @serve-tools/client-shared-http-stream
```

#### Import from a CDN

```js
import * as clientSharedHttpStream from "https://esm.run/@serve-tools/client-shared-http-stream";
```

The worker owns the underlying HTTP stream client and its authorization configuration.
Each page owns its logical client, subscriptions, and `MessagePort`.
Closing one page client does not close the worker-owned client used by other pages.

This package preserves the finite-request and server-to-client subscription semantics of `@serve-tools/client-http-stream`.
It does not turn HTTP into a persistent bidirectional session or add reconnection, replay, persistence, or resumption.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-shared-http-stream`](./skills/serve-tools-client-shared-http-stream/SKILL.md).

## License

[MIT-0](./LICENSE.md)
