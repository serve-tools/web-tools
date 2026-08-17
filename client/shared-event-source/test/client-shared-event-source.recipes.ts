import { listen } from "../src/lib/scope/shared-worker.js";
import { connect } from "../src/lib/scope/window.js";

interface Events {
	presence: { online: number };
}

declare const worker: SharedWorker;

export const eventSource = listen<Events>("https://example.com/events");
export const client = connect<Events>(worker.port);
export const presence = client.subscribe("presence", ({ data, lastEventId }) => console.log(lastEventId, data.online));
