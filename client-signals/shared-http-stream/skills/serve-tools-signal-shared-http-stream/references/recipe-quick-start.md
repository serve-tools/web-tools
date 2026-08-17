# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-shared-http-stream.recipes.ts` fixture in the package source.

```ts
import type { SharedHTTPStreamClient } from "@serve-tools/client-shared-http-stream/scope/window";
import { observe } from "@serve-tools/signal-shared-http-stream";

declare const client: SharedHTTPStreamClient<{
	subscriptions: { presence(room: string): { online: boolean } };
}>;

export const presence = observe(client, "presence", { input: "lobby" });
```
