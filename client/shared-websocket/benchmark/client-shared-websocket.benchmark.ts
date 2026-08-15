/// <reference lib="dom" />

import { expect, test } from "vitest";
import { benchmark } from "../../benchmark.js";
import { connect } from "../src/lib/scope/window.js";
import type { TestProtocol } from "../test/browser/shared-websocket.js";

const open = (name: string) => {
	const worker = new SharedWorker(new URL("../test/browser/shared-websocket.ts", import.meta.url), {
		name,
		type: "module",
	});
	const client = connect<TestProtocol>(worker.port);

	return { client, close: () => (client.close(), worker.port.close()) };
};

test("SharedWorker WebSocket round trips and fanout", async () => {
	const connections = Array.from({ length: 8 }, () => open(crypto.randomUUID()));
	const sharedName = crypto.randomUUID();
	const shared = Array.from({ length: 8 }, () => open(sharedName));
	let deliveries = 0;
	const subscriptions = shared.map(({ client }) => client.subscribe("values", () => ++deliveries));

	try {
		await benchmark(
			"client-shared-websocket/round-trip",
			async () => {
				await connections[0]!.client.request("echo", 1);
			},
			{ iterations: 100 },
		);

		await expect.poll(() => shared[0]!.client.request("subscriberCount")).toBe(8);
		await benchmark(
			"client-shared-websocket/fanout-8",
			async () => {
				const expected = deliveries + 8;

				await shared[0]!.client.request("emit", 1);
				while (deliveries < expected) {
					await new Promise(requestAnimationFrame);
				}
			},
			{ iterations: 50, samples: 10, warmup: 3 },
		);
	} finally {
		subscriptions.forEach((subscription) => {
			subscription.unsubscribe();
		});
		connections.forEach((connection) => {
			connection.close();
		});
		shared.forEach((connection) => {
			connection.close();
		});
	}
});
