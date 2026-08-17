# @serve-tools/client-shared-event-source

`@serve-tools/client-shared-event-source` shares one native EventSource connection across pages through a `SharedWorker`.

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
using client = connect<{ presence: { online: number } }>(worker.port);
using presence = client.subscribe("presence", ({ data, lastEventId }) => console.log(lastEventId, data.online));
```

## Install

```shell
npm install @serve-tools/client-shared-event-source
```

The worker owns the native EventSource and its browser-managed reconnection state.
Each page owns its logical subscriptions and `MessagePort`.
Parsed JSON event records retain `type`, `origin`, and `lastEventId` across the worker boundary.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-client-shared-event-source`](./skills/serve-tools-client-shared-event-source/SKILL.md).

## License

[MIT-0](./LICENSE.md)
