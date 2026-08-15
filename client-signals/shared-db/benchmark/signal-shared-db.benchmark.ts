import type {
	SharedDBClient,
	SharedDBSubscribeOptions,
	SharedDBSubscriber,
	SharedDBSubscription,
} from "@serve-tools/client-shared-db";
import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { SignalDB } from "../src/signal-shared-db.js";

type BenchmarkSchema = Record<string, SignalDB.Store<number, string>>;

class BenchmarkClient {
	readonly closed = new Promise<void>(() => {});
	readonly subscriptions = new Set<Subscription>();
	reads = 0;

	readonly source = {
		closed: this.closed,
		get: async () => ++this.reads,
		getAll: async () => [],
		getAllKeys: async () => [],
		has: async () => false,
		count: async () => 0,
		add: async () => "key",
		put: async () => "key",
		delete: async () => {},
		clear: async () => {},
		subscribe: (
			storeNames: string | readonly string[],
			subscriber: SharedDBSubscriber<BenchmarkSchema>,
			options?: SharedDBSubscribeOptions,
		): SharedDBSubscription => {
			const record: Subscription = {
				active: true,
				storeNames: typeof storeNames === "string" ? [storeNames] : storeNames,
				subscriber,
			};

			this.subscriptions.add(record);
			options?.onReady?.(0);

			const unsubscribe = () => {
				if (!record.active) {
					return;
				}

				record.active = false;
				this.subscriptions.delete(record);
			};

			return {
				get active() {
					return record.active;
				},
				unsubscribe,
				[Symbol.dispose]: unsubscribe,
			};
		},
		close() {},
		[Symbol.dispose]() {},
	} as unknown as SharedDBClient<BenchmarkSchema>;

	emit(store: string): void {
		for (const subscription of this.subscriptions) {
			if (subscription.storeNames.includes(store)) {
				subscription.subscriber({ kind: "invalidated", revision: 1, store });
			}
		}
	}
}

interface Subscription {
	active: boolean;
	readonly storeNames: readonly string[];
	readonly subscriber: SharedDBSubscriber<BenchmarkSchema>;
}

const settle = async (): Promise<void> => {
	for (let turn = 0; turn < 5; ++turn) {
		await Promise.resolve();
	}
};

test("query construction and shared-store change delivery", async () => {
	const client = new BenchmarkClient();
	const database = new SignalDB(client.source);

	await benchmark(
		"signal-shared-db/create-dispose-100-same-store-queries",
		async () => {
			const queries = Array.from({ length: 100 }, (_, index) => database.watch("shared", String(index)));

			await settle();

			for (const query of queries) {
				query.dispose();
			}
		},
		{ iterations: 100, samples: 10, warmup: 3 },
	);

	const queries = Array.from({ length: 1_000 }, (_, index) => database.watch("shared", String(index)));

	await settle();
	expect(client.subscriptions.size).toBe(1);

	let revision = 0;

	await benchmark(
		"signal-shared-db/deliver-change-to-1k-same-store-queries",
		async () => {
			client.emit("shared");
			await settle();
			++revision;
		},
		{ iterations: 100, samples: 10, warmup: 3 },
	);

	expect(queries[0]!.get().status).toBe("ready");
	expect(revision).toBeGreaterThan(0);

	for (const query of queries) {
		query.dispose();
	}

	database.close();
});

test("sparse explicit invalidation", async () => {
	const client = new BenchmarkClient();
	const database = new SignalDB(client.source);
	const queries = Array.from({ length: 10_000 }, (_, index) => database.watch(`store-${index}`, "key"));

	await settle();

	await benchmark(
		"signal-shared-db/invalidate-one-among-10k-store-queries",
		async () => {
			database.invalidate("store-5000");
			await settle();
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	expect(queries[5_000]!.get().status).toBe("ready");

	for (const query of queries) {
		query.dispose();
	}

	database.close();
});
