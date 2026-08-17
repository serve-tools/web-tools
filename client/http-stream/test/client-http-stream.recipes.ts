import type { ProtocolType } from "../src/client-http-stream.js";
import { connect } from "../src/client-http-stream.js";

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
