# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-http-stream.recipes.ts` fixture in the package source.

```ts
import type { ProtocolType } from "@serve-tools/client-http-stream";
import { connect } from "@serve-tools/client-http-stream";

/** A compile-tested authenticated Fetch request and streaming subscription recipe. */
export function clientHTTPStreamRecipe(signal: AbortSignal) {
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

export type ClientHTTPStreamProtocol = ProtocolType<ReturnType<typeof clientHTTPStreamRecipe>>;
```
