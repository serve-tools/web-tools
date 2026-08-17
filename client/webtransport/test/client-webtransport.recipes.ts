import type { ProtocolType } from "../src/client-webtransport.js";
import { connect } from "../src/client-webtransport.js";

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

	// @ts-expect-error transport adapters own incoming protocol delivery
	client.receive(new ArrayBuffer(0));
	// @ts-expect-error transport adapters own protocol failure handling
	client.fail();
	// @ts-expect-error transport adapters own physical disconnect handling
	client.disconnect();

	return client;
}

export type ClientWebTransportProtocol = ProtocolType<Awaited<ReturnType<typeof clientWebTransportRecipe>>>;
