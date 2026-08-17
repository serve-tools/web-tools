import { serve } from "@serve-tools/client-messaging";
import { expect, test, vi } from "vitest";
import { connect } from "../src/lib/connect.js";

test("forwards JSON event records with IDs over a message port", async () => {
	const channel = new MessageChannel();
	const server = serve<{
		subscriptions: {
			event(input: { name: string }): { data: unknown; lastEventId: string; origin: string; type: string };
		};
	}>(channel.port1, {
		subscriptions: {
			event: ({ name }, { emit }) => emit({ data: { online: 4 }, lastEventId: "4", origin: "test", type: name }),
		},
	});
	const client = connect<{ presence: { online: number } }>(channel.port2);
	const received: unknown[] = [];

	try {
		client.subscribe("presence", (event) => received.push(event));
		await vi.waitFor(() =>
			expect(received).toEqual([{ data: { online: 4 }, lastEventId: "4", origin: "test", type: "presence" }]),
		);
	} finally {
		client.close();
		server.close();
		channel.port1.close();
		channel.port2.close();
	}
});
