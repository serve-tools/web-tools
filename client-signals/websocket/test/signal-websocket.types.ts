import type { Client } from "../src/signal-websocket.js";
import { observe } from "../src/signal-websocket.js";

declare const client: Client<{
	subscriptions: { status(): string; room(id: number): { online: boolean } };
}>;

observe(client, "status");
observe(client, "room", { input: 1 });
// @ts-expect-error input is required
observe(client, "room");
// @ts-expect-error input must match the protocol
observe(client, "room", { input: "1" });
