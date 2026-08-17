# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-realtime.recipes.ts` fixture in the package source.

```ts
import type { ProtocolType } from "@serve-tools/client-realtime";
import { createClient } from "@serve-tools/client-realtime";

/** A compile-tested custom transport adapter and typed operation recipe. */
export function clientRealtimeRecipe(send: (payload: ArrayBuffer) => void) {
	const client = createClient<{
		requests: { ping(value: string): string };
		subscriptions: { notices(): string };
	}>({ send, close: console.error });

	void client.request("ping", "hello");
	using _notices = client.subscribe("notices", console.log);

	return client;
}

export type ClientRealtimeProtocol = ProtocolType<ReturnType<typeof clientRealtimeRecipe>>;
```
