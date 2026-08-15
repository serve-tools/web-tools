# Recipe: quick start

This public-import example is generated from the compile-checked `test/client-websocket.recipes.ts` fixture in the package source.

```ts
import type { ProtocolType } from "@serve-tools/client-websocket";
import { connect } from "@serve-tools/client-websocket";

interface Credentials {
	readonly token: string;
}

interface Session {
	readonly userID: string;
}

interface Message {
	readonly body: string;
}

/** A compile-tested inline protocol, request, subscription, cancellation, extraction, and disposal recipe. */
export async function websocketRecipe(signal: AbortSignal): Promise<void> {
	await using client = await connect<{
		requests: {
			authenticate(credentials: Credentials): Session;
			ping(): void;
		};
		subscriptions: {
			messages(room: string): Message;
		};
	}>("wss://example.test/socket", { signal });

	exportProtocol(client);

	const session = await client.request("authenticate", { token: "secret" }, { signal });
	using _messages = client.subscribe("messages", "general", (message) => console.log(message.body), { signal });

	console.log(session.userID);
}

const exportProtocol = <Client>(client: Client): void => {
	void client;
};

declare const protocolClient: Awaited<ReturnType<typeof createProtocolClient>>;

const createProtocolClient = () =>
	connect<{
		requests: { ping(): void };
	}>("wss://example.test/socket");

export type PingProtocol = ProtocolType<typeof protocolClient>;
```
