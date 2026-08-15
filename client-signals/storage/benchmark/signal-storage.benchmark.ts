import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { SignalStorage } from "../src/signal-storage.js";

type BenchmarkSchema = Record<string, string>;

test("watch construction and updates", async () => {
	localStorage.clear();

	const storage = new SignalStorage<BenchmarkSchema>();

	await benchmark(
		"signal-storage/create-dispose-100-watches",
		() => {
			const watches = Array.from({ length: 100 }, (_, index) => storage.watch(`key-${index}`));

			for (const watch of watches) {
				watch.dispose();
			}
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	const dense = Array.from({ length: 1_000 }, () => storage.watch("dense"));

	let value = 0;

	await benchmark(
		"signal-storage/update-1k-same-key-watches",
		() => {
			storage.set("dense", String(++value));
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	expect(dense[0]!.get()).toBe(String(value));

	for (const watch of dense) {
		watch.dispose();
	}

	localStorage.clear();
});

test("sparse updates and explicit refreshes", async () => {
	localStorage.clear();

	const storage = new SignalStorage<BenchmarkSchema>();
	const sparse = Array.from({ length: 10_000 }, (_, index) => storage.watch(`key-${index}`));

	let value = 0;

	await benchmark(
		"signal-storage/update-one-among-10k-watches",
		() => {
			storage.set("key-5000", String(++value));
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	expect(sparse[5_000]!.get()).toBe(String(value));

	storage.source.setItem("key-5000", "external");

	await benchmark("signal-storage/refresh-one-among-10k-watches", () => sparse[5_000]!.refresh(), {
		iterations: 100_000,
		samples: 10,
		warmup: 3,
	});

	for (const watch of sparse) {
		watch.dispose();
	}

	localStorage.clear();
});
