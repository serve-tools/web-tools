# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-shared-webtransport.recipes.ts` fixture in the package source.

```ts
import { listen } from "@serve-tools/signal-shared-webtransport/scope/shared-worker";
import { connect, observe } from "@serve-tools/signal-shared-webtransport";

interface Protocol {
	subscriptions: { presence(room: string): { online: boolean } };
}

declare const port: Parameters<typeof connect>[0];

export const server = listen<Protocol>("https://example.com/realtime");
export const client = connect<Protocol>(port);
export const presence = observe(client, "presence", { input: "lobby" });
```
