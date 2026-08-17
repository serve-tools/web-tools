# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-webtransport.recipes.ts` fixture in the package source.

```ts
import type { ProtocolType } from "@serve-tools/client-webtransport";
import { connect } from "@serve-tools/client-webtransport";

/** A compile-tested reliable operation and typed datagram recipe. */
export async function clientWebTransportRecipe(signal: AbortSignal) {
	const client = await connect<{
		requests: { load(id: string): string };
		datagrams: {
			cursor: { client: { x: number; y: number }; server: { x: number; y: number } };
			packet: { client: Uint8Array };
		};
	}>("https://example.test/realtime", { signal });

	void client.request("load", "board");
	await client.datagrams.write("cursor", { x: 1, y: 2 });
	await client.datagrams.write("packet", Uint8Array.of(1, 2));
	using _cursor = client.datagrams.subscribe("cursor", console.log);

	return client;
}

export type ClientWebTransportProtocol = ProtocolType<Awaited<ReturnType<typeof clientWebTransportRecipe>>>;
```
