import { connect } from "../src/lib/scope/window.js";

declare const port: MessagePort;

const client = connect<{ presence: { online: number } }>(port);

client.subscribe("presence", ({ data, lastEventId }) => {
	const online: number = data.online;
	const id: string = lastEventId;
	void online;
	void id;
});

// @ts-expect-error unknown event name
client.subscribe("missing", () => undefined);
