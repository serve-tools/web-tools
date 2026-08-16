# Share a WebSocket across windows

Import the window client from `@serve-tools/client` and the worker server from its owning package.
Declare both packages as direct dependencies.

```ts
// presence.worker.ts
import { listen } from "@serve-tools/client-shared-websocket/scope/shared-worker";

export interface AppProtocol {
	subscriptions: {
		presence(room: string): { online: number };
	};
}

export const server = listen<AppProtocol>("wss://example.com/presence");
```

```ts
// presence.ts
import { connect } from "@serve-tools/client/shared-websocket";
import type { AppProtocol } from "./presence.worker.js";

const worker = new SharedWorker(new URL("./presence.worker.js", import.meta.url), {
	name: "presence",
	type: "module",
});

export const client = connect<AppProtocol>(worker.port);
```

Pages using the same worker URL and name share its physical WebSocket.
Each page still owns and closes its client and `MessagePort`; the worker owns the server and physical WebSocket.
