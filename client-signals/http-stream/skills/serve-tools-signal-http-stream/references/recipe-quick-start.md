# Recipe: quick start

This public-import example is generated from the compile-checked `test/signal-http-stream.recipes.ts` fixture in the package source.

```ts
import { connect, observe } from "@serve-tools/signal-http-stream";

export const client = connect<{ subscriptions: { presence(room: string): { online: boolean } } }>(
	"https://example.com/realtime",
);
export const presence = observe(client, "presence", { input: "lobby" });
```
