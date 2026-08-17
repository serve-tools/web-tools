import { expect, test } from "vitest";
import { connect } from "../../src/client-event-source.js";

test("preserves native reconnection and Last-Event-ID", async () => {
	const token = crypto.randomUUID();
	const client = connect<{
		presence: { online: number; resumedAfter?: string };
	}>(`/events?token=${token}`);
	const received = Promise.withResolvers<void>();
	const events: { online: number; resumedAfter?: string; lastEventId: string }[] = [];

	try {
		client.subscribe("presence", ({ data, lastEventId }) => {
			events.push({ ...data, lastEventId });

			if (events.length === 2) {
				received.resolve();
			}
		});

		await received.promise;

		expect(events).toEqual([
			{ online: 1, lastEventId: "event-1" },
			{ online: 2, resumedAfter: "event-1", lastEventId: "event-2" },
		]);
	} finally {
		client.close();
	}
});
