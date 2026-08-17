import { connect, observe } from "../src/signal-websocket.js";

export const client = await connect<{
	subscriptions: { presence(room: string): { online: boolean } };
}>("wss://example.com/realtime");
export const presence = observe(client, "presence", { input: "lobby" });
