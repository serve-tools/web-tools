import { connect } from "../src/client-event-source.js";

const client = connect<{ message: string; presence: { online: number }; list: readonly (number | null)[] }>(
	"https://example.test/events",
);

client.subscribe("presence", (event) => {
	const count: number = event.data.online;
	const id: string = event.lastEventId;
	void count;
	void id;
});

// @ts-expect-error unknown event name
client.subscribe("missing", () => undefined);
// @ts-expect-error Date is not a JSON value
connect<{ invalid: Date }>("https://example.test/events");
// @ts-expect-error reportError is the required client-platform global, not a connection option
connect("https://example.test/events", { reportError: () => undefined });
