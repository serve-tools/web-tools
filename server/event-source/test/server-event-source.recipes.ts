import { createHandler } from "../src/server-event-source.js";

export const events = createHandler<{
	message: { text: string };
	presence: { online: number };
}>({
	connect(connection) {
		console.log("resume after", connection.lastEventId);
	},
});

events.send("presence", { online: 3 }, { id: "presence-42" });
