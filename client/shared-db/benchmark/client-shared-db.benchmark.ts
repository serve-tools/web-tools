/// <reference lib="dom" />

import { expect, test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { connect } from "../src/lib/scope/window.js";
import type { BenchmarkSchema } from "./client-shared-db.worker.js";

const open = (name: string) => {
	const worker = new SharedWorker(new URL("./client-shared-db.worker.ts", import.meta.url), { name, type: "module" });
	const database = connect<BenchmarkSchema>(worker.port);

	return {
		database,
		close(): void {
			database.close();
			worker.port.close();
		},
	};
};

test("SharedWorker database round trips", async () => {
	const connection = open(crypto.randomUUID());
	const { database } = connection;
	let id = 1;

	try {
		await database.put("records", { id: 0, value: "seed" });
		expect(await database.get("records", 0)).toEqual({ id: 0, value: "seed" });

		await benchmark(
			"client-shared-db/get",
			async () => {
				await database.get("records", 0);
			},
			{ iterations: 100 },
		);

		await benchmark(
			"client-shared-db/put",
			async () => {
				await database.put("records", { id: id++, value: "value" });
			},
			{ iterations: 50 },
		);
	} finally {
		connection.close();
	}
});

test("SharedWorker database change fanout", async () => {
	const sharedName = crypto.randomUUID();
	const connections = Array.from({ length: 8 }, () => open(sharedName));
	const ready = connections.map(() => Promise.withResolvers<number>());
	let deliveries = 0;
	const subscriptions = connections.map(({ database }, index) =>
		database.subscribe("records", () => ++deliveries, {
			onReady: ready[index]!.resolve,
			onError: ready[index]!.reject,
		}),
	);
	let id = 0;

	try {
		await Promise.all(ready.map(({ promise }) => promise));

		await benchmark(
			"client-shared-db/put-8-subscribers",
			async () => {
				const expectedDeliveries = deliveries + connections.length;

				await connections[0]!.database.put("records", { id: id++, value: "value" });

				while (deliveries < expectedDeliveries) {
					await new Promise(requestAnimationFrame);
				}
			},
			{ iterations: 25, samples: 10, warmup: 3 },
		);

		expect(deliveries).toBe(id * connections.length);
	} finally {
		subscriptions.forEach((subscription) => {
			subscription.unsubscribe();
		});
		connections.forEach((connection) => {
			connection.close();
		});
	}
});
