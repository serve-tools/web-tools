# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-sse.recipes.ts` fixture in the package source.

```ts
import type { ProtocolType } from "@serve-tools/client-sse";
import { connect } from "@serve-tools/client-sse";

/** A compile-tested authenticated Fetch request and streaming subscription recipe. */
export function clientSSERecipe(signal: AbortSignal) {
	const client = connect<{
		requests: { identity(): string };
		subscriptions: { notices(room: string): string };
	}>("https://example.test/realtime", {
		headers: { Authorization: "Bearer token" },
		signal,
	});

	void client.request("identity");
	using _notices = client.subscribe("notices", "general", console.log, { signal });

	return client;
}

export type ClientSSEProtocol = ProtocolType<ReturnType<typeof clientSSERecipe>>;
```
