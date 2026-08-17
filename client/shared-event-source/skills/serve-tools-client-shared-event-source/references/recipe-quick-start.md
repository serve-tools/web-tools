# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-shared-event-source.recipes.ts` fixture in the package source.

```ts
import { listen } from "@serve-tools/client-shared-event-source/scope/shared-worker";
import { connect } from "@serve-tools/client-shared-event-source/scope/window";

interface Events {
	presence: { online: number };
}

declare const worker: SharedWorker;

export const eventSource = listen<Events>("https://example.com/events");
export const client = connect<Events>(worker.port);
export const presence = client.subscribe("presence", ({ data, lastEventId }) => console.log(lastEventId, data.online));
```
