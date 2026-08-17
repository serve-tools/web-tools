# @serve-tools/client-shared-http-stream

`@serve-tools/client-shared-http-stream` coordinates typed HTTP requests and streaming subscriptions through a `SharedWorker`.

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
using client = connect<RealtimeProtocol>(worker.port);
using presence = client.subscribe("presence", "lobby", console.log);
```

## Install

```shell
npm install @serve-tools/client-shared-http-stream
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
