import assert from "node:assert/strict";
import { connect } from "../../../../client/websocket/src/client-websocket.ts";
import { subprotocol } from "../../../../realtime/protocol/src/realtime-protocol.ts";
import { attach } from "../../src/server-websocket.ts";

interface Protocol {
	requests: {
		identity(): string;
	};
	subscriptions: {
		numbers(start: number): number;
	};
}

const handlers = {
	requests: {
		identity: (_input: undefined, { connection }: { connection: { user: string } }) => connection.user,
	},
	subscriptions: {
		numbers: (start: number, { emit, complete }: { emit(value: number): void; complete(): void }) => {
			emit(start);
			emit(start + 1);
			complete();
		},
	},
};
const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, (request) => {
	const upgrade = Deno.upgradeWebSocket(request, { protocol: subprotocol });

	attach<Protocol, { user: string }>(upgrade.socket, handlers, { user: "grace" });

	return upgrade.response;
});

try {
	const address = server.addr as Deno.NetAddr;

	{
		await using client = await connect<Protocol>(`ws://127.0.0.1:${address.port}`);

		assert.equal(await client.request("identity"), "grace");

		const events: number[] = [];
		const completed = Promise.withResolvers<void>();

		client.subscribe("numbers", 5, (event) => events.push(event), { onComplete: completed.resolve });
		await completed.promise;

		assert.deepEqual(events, [5, 6]);
	}
} finally {
	await server.shutdown();
}
