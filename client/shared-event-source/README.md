# @serve-tools/client-shared-event-source

Receive live events in several tabs while sharing one native EventSource connection in a SharedWorker.

```ts
// events.worker.ts
import { listen } from "@serve-tools/client-shared-event-source/scope/shared-worker";

export const eventSource = listen<{
	presence: { online: number };
}>("https://example.com/events");
```

```ts
// page.ts
import { connect } from "@serve-tools/client-shared-event-source/scope/window";

const worker = new SharedWorker(new URL("./events.worker.js", import.meta.url), { type: "module" });
const client = connect<{ presence: { online: number } }>(worker.port);
const presence = client.subscribe("presence", ({ data, lastEventId }) => console.log(lastEventId, data.online));

addEventListener("pagehide", () => {
	presence.unsubscribe();
	client.close();
	worker.port.close();
});
```

Run the worker setup once, then run the page code in two same-origin tabs using the same worker URL and name.
Both tabs use one native event feed; each tab retains its own client and subscription.
The example's presence event carries an online count and is printed by each interested page.
The endpoint must serve a native server-sent event feed, with named `presence` events and JSON data such as `{ "online": 3 }`.
Declared TypeScript types do not validate incoming values.

Next, subscribe to another named event while the browser handles native EventSource reconnection.
Use the [direct client](../event-source/) when each page should own its connection.
Closing a page client leaves other tabs active; the page owner must also close its `MessagePort` when finished.

The page connection closes on every `pagehide`, including when entering the back/forward cache.
On a persisted `pageshow`, create a fresh worker port, client, and subscriptions using the [mount and restore recipe](../messaging/#backforward-cache).

## Install

```shell
npm install @serve-tools/client-shared-event-source
```

#### Import from a CDN

```js
import * as clientSharedEventSource from "https://esm.run/@serve-tools/client-shared-event-source";
```

The worker owns the native EventSource and its browser-managed reconnection state.
Each page owns its logical subscriptions and `MessagePort`.
Parsed JSON event records retain `type`, `origin`, and `lastEventId` across the worker boundary.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-shared-event-source`](./skills/serve-tools-client-shared-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
