# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-shared-webtransport.recipes.ts` fixture in the package source.

```ts
import type { SharedWebTransportClient } from "@serve-tools/client-shared-webtransport/scope/window";
import { observe } from "@serve-tools/signal-shared-webtransport";

declare const client: SharedWebTransportClient<{
	subscriptions: { presence(room: string): { online: boolean } };
}>;

export const presence = observe(client, "presence", { input: "lobby" });
```
