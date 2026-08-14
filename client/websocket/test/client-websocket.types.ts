import type { ProtocolType, RequestOptions, SubscribeOptions } from "../src/client-websocket.js";
import { connect } from "../src/client-websocket.js";

interface Credentials {
	readonly token: string;
}

interface Session {
	readonly userID: string;
}

interface Message {
	readonly body: string;
}

interface ChatProtocol {
	requests: {
		authenticate(credentials: Credentials): Session;
		ping(): void;
	};
	subscriptions: {
		messages(room: string): Message;
		presence(): number;
	};
}

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

const pendingClient = connect<ChatProtocol>("wss://example.test/socket");

async function useClient(requestOptions: RequestOptions, subscribeOptions: SubscribeOptions): Promise<void> {
	await using client = await pendingClient;

	const session: Session = await client.request("authenticate", { token: "secret" }, requestOptions);
	const pong: ReturnType<() => void> = await client.request("ping", undefined, requestOptions);
	using messages = client.subscribe("messages", "general", (message) => message.body, subscribeOptions);
	using presence = client.subscribe("presence", (count) => count.toFixed(), subscribeOptions);

	// @ts-expect-error unknown request name
	await client.request("missing");
	// @ts-expect-error wrong request input
	await client.request("authenticate", { password: "secret" });
	// @ts-expect-error no-input requests do not accept an input value
	await client.request("ping", "now");
	// @ts-expect-error wrong subscription input
	client.subscribe("messages", 1, () => undefined);
	// @ts-expect-error subscription events are Message values
	client.subscribe("messages", "general", (message: string) => message);

	void session;
	void pong;
	void messages;
	void presence;
}

// @ts-expect-error operations accept zero or one input
connect<{ requests: { invalid(first: string, second: string): void } }>("wss://example.test/socket");

export type PendingExtractedProtocol = Expect<Equal<ProtocolType<typeof pendingClient>, ChatProtocol>>;
export type ExtractedProtocol = Expect<Equal<ProtocolType<Awaited<typeof pendingClient>>, ChatProtocol>>;
export type NamespacedPendingExtractedProtocol = Expect<
	Equal<connect.ProtocolType<typeof pendingClient>, ChatProtocol>
>;
export type NamespacedExtractedProtocol = Expect<
	Equal<connect.ProtocolType<Awaited<typeof pendingClient>>, ChatProtocol>
>;
export type UnbrandedProtocolTypeIsNever = Expect<Equal<ProtocolType<Record<never, never>>, never>>;

export { useClient };
