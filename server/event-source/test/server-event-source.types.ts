import { createHandler } from "../src/server-event-source.js";

const handler = createHandler<{ message: string; presence: { online: number } }>({
	headers: new Headers({ "Access-Control-Allow-Origin": "https://app.example.test" }),
	maximumBufferedAmount: 1024,
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

// @ts-expect-error response headers must be a HeadersInit value
createHandler({ headers: 1 });
