# @serve-tools/client-shared-websocket

`@serve-tools/client-shared-websocket` provides typed requests and subscriptions over a shared `WebSocket` owned by a `SharedWorker`.
It uses a compact binary protocol with built-in serialization for structured JavaScript values, including cyclic graphs and binary data.

```ts
// project.worker.ts
import { listen } from "@serve-tools/client-shared-websocket/scope/shared-worker";

export const server = listen<{
	requests: {
		openProject: (input: { id: string }) => { id: string; title: string };
		ping: () => void;
	};
	subscriptions: {
		projectChanged: (input: { id: string }) => { revision: number };
	};
}>("wss://example.com/app");

export type ProjectProtocol = listen.ProtocolType<typeof server>;
```

```ts
// app.ts
import { connect } from "@serve-tools/client-shared-websocket/scope/window";
import type { ProjectProtocol } from "./project.worker.js";

const worker = new SharedWorker(new URL("./project.worker.js", import.meta.url), { type: "module" });

using client = connect<ProjectProtocol>(worker.port);

const project = await client.request("openProject", { id: "project-1" });

using changes = client.subscribe("projectChanged", { id: project.id }, (event) => {
	console.log(event.revision);
});
```

Closing a page client closes only its logical protocol connection to the worker.
It does not close the page's `MessagePort`; call `worker.port.close()` separately when the page no longer needs the port.
The worker owns the physical socket until `server.close()`, the WebSocket closes, or the worker terminates.
Values cross the worker boundary with structured clone before the WebSocket package serializes them.
This package does not reconnect, replay, authenticate, or implement a server.

## Development

```shell
npm ci --ignore-scripts
npm run verify
npm run benchmark --workspace @serve-tools/client-shared-websocket
```

The package Skill is at [`skills/serve-tools-client-shared-websocket`](./skills/serve-tools-client-shared-websocket/SKILL.md).
