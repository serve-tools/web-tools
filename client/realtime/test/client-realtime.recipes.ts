import type { ProtocolType } from "../src/client-realtime.js";
import { createClient } from "../src/client-realtime.js";

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
