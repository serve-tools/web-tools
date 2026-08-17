# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-webtransport.recipes.ts` fixture in the package source.

```ts
import type { Client } from "@serve-tools/client-webtransport";
import { observe } from "@serve-tools/signal-webtransport";

declare const client: Client<{ subscriptions: { presence(room: string): { online: boolean } } }>;

export const presence = observe(client, "presence", { input: "lobby" });
```
