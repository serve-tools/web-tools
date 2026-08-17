import { listen } from "@serve-tools/signal-shared-http-stream/scope/shared-worker";
import { connect, observe } from "../src/signal-shared-http-stream.js";

interface Protocol {
	subscriptions: { presence(room: string): { online: boolean } };
}

declare const port: Parameters<typeof connect>[0];

export const server = listen<Protocol>("https://example.com/realtime");
export const client = connect<Protocol>(port);
export const presence = observe(client, "presence", { input: "lobby" });
