import { createHandler } from "../src/server-event-source.js";

const handler = createHandler<{ message: string; presence: { online: number } }>({
	connect(connection) {
		const id: string = connection.lastEventId;
		connection.send("presence", { online: 2 }, { id: "2" });
		void id;
	},
});

handler.send("message", "ready");
// @ts-expect-error event data must match
handler.send("presence", "offline");

// @ts-expect-error server failures are reported automatically, not through handler options
createHandler({ reportError: () => undefined });
