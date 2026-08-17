import { connect, observe } from "../src/signal-webtransport.js";

export const client = await connect<{
	subscriptions: { presence(room: string): { online: boolean } };
}>("https://example.com/realtime");
export const presence = observe(client, "presence", { input: "lobby" });
