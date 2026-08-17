# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-shared-http-stream.recipes.ts` fixture in the package source.

```ts
import { listen } from "@serve-tools/signal-shared-http-stream/scope/shared-worker";
import { connect, observe } from "@serve-tools/signal-shared-http-stream";

interface Protocol {
	subscriptions: { presence(room: string): { online: boolean } };
}

declare const port: Parameters<typeof connect>[0];

export const server = listen<Protocol>("https://example.com/realtime");
export const client = connect<Protocol>(port);
export const presence = observe(client, "presence", { input: "lobby" });
```
