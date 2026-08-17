# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-webtransport.recipes.ts` fixture in the package source.

```ts
import { connect, observe } from "@serve-tools/signal-webtransport";

export const client = await connect<{
	subscriptions: { presence(room: string): { online: boolean } };
}>("https://example.com/realtime");
export const presence = observe(client, "presence", { input: "lobby" });
```
