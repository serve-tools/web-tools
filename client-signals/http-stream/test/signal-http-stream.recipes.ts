import { connect, observe } from "../src/signal-http-stream.js";

export const client = connect<{ subscriptions: { presence(room: string): { online: boolean } } }>(
	"https://example.com/realtime",
);
export const presence = observe(client, "presence", { input: "lobby" });
