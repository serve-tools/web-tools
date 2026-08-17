import type { SharedEventSourceClient } from "../src/signal-shared-event-source.js";
import { observe } from "../src/signal-shared-event-source.js";

declare const client: SharedEventSourceClient<{ presence: { online: number } }>;

const presence = observe(client, "presence");
const state = presence.get();

if (state.status === "ready") {
	const online: number = state.event.data.online;
	const id: string = state.event.lastEventId;

	void online;
	void id;
}
