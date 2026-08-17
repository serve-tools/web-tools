# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-shared-webtransport.recipes.ts` fixture in the package source.

```ts
import { listen } from "@serve-tools/client-shared-webtransport/scope/shared-worker";
import { connect } from "@serve-tools/client-shared-webtransport/scope/window";

interface AppProtocol {
	requests: {
		profile(id: string): { id: string; name: string };
	};
	subscriptions: {
		presence(room: string): { userId: string; online: boolean };
	};
	datagrams: {
		cursor: { client: { x: number; y: number }; server: { x: number; y: number } };
	};
}

declare const worker: SharedWorker;

export const client = connect<AppProtocol>(worker.port);
export const server = listen<AppProtocol>("https://example.com/realtime");
```
