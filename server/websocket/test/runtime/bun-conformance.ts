import assert from "node:assert/strict";

import { connect } from "../../../../client/websocket/src/client-websocket.ts";
import { createBunAdapter } from "../../src/runtime/bun.ts";

interface Protocol {
	requests: {
		identity(): string;
	};
	subscriptions: {
		numbers(start: number): number;
	};
}

const adapter = createBunAdapter<Protocol, { user: string }>(
	{
		requests: {
			identity: (_input, { connection }) => connection.user,
		},
		subscriptions: {
			numbers: (start, { emit, complete }) => {
				emit(start);
				emit(start + 1);
				complete();
			},
		},
	},
	{ authorize: () => ({ user: "ada" }) },
);
const server = Bun.serve({
	port: 0,
	websocket: adapter.websocket,
	fetch: (request, server) => adapter.upgrade(request, server),
});

try {
	{
		await using client = await connect<Protocol>(`ws://127.0.0.1:${server.port}`, {
			signal: AbortSignal.timeout(5_000),
		});

		assert.equal(await client.request("identity"), "ada");

		const events: number[] = [];
		const completed = Promise.withResolvers<void>();

		client.subscribe("numbers", 3, (event) => events.push(event), { onComplete: completed.resolve });

		await completed.promise;

		assert.deepEqual(events, [3, 4]);
	}
} finally {
	adapter.close();
	server.stop(true);
}
