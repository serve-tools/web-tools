import type { Client } from "../src/signal-event-source.js";
import { observe } from "../src/signal-event-source.js";

declare const client: Client<{ presence: { online: number } }>;

const presence = observe(client, "presence");
const state = presence.get();

if (state.status === "ready") {
	const online: number = state.event.data.online;
	const id: string = state.event.lastEventId;

	void online;
	void id;
}

// @ts-expect-error unknown event name
observe(client, "missing");
