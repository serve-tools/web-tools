import { connect } from "../src/client-event-source.js";

export const events = connect<{
	message: { text: string };
	presence: { online: number };
}>("https://example.com/events", { withCredentials: true });

export const presence = events.subscribe("presence", ({ data, lastEventId }) => {
	console.log(lastEventId, data.online);
});
