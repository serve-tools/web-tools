import { listen } from "@serve-tools/signal-shared-websocket/scope/shared-worker";
import { connect, observe } from "../src/signal-shared-websocket.js";

interface Protocol {
	subscriptions: { updates(): string };
}

declare const port: Parameters<typeof connect>[0];

export const server = listen<Protocol>("wss://example.com/realtime");
export const client = connect<Protocol>(port);
export const updates = observe(client, "updates");
