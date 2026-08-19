import { test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { AsyncOperation } from "../src/operation.js";

let sink = 0;

test("async operation lifecycle", async () => {
	await benchmark(
		"async-operation/result",
		async () => {
			sink += await new AsyncOperation(() => 1).result;
		},
		{ iterations: 100_000 },
	);

	await benchmark(
		"async-operation/one-value",
		async () => {
			const operation = new AsyncOperation<number, number>(async ({ write }) => {
				await write(1);

				return 2;
			});

			for await (const value of operation) {
				sink += value;
			}

			sink += await operation.result;
		},
		{ iterations: 20_000 },
	);

	await benchmark(
		"async-operation/32-values-unbuffered",
		async () => {
			const operation = new AsyncOperation<number, number>(async ({ write }) => {
				for (let value = 1; value <= 32; ++value) {
					await write(value);
				}

				return 33;
			});

			for await (const value of operation) {
				sink += value;
			}

			sink += await operation.result;
		},
		{ iterations: 2_000 },
	);

	const partialStrategy = new CountQueuingStrategy({ highWaterMark: 8 });

	await benchmark(
		"async-operation/32-values-buffer-8",
		async () => {
			const operation = new AsyncOperation<number, number>(
				async ({ write }) => {
					for (let value = 1; value <= 32; ++value) {
						await write(value);
					}

					return 33;
				},
				{ strategy: partialStrategy },
			);

			for await (const value of operation) {
				sink += value;
			}

			sink += await operation.result;
		},
		{ iterations: 5_000 },
	);

	const strategy = new CountQueuingStrategy({ highWaterMark: 32 });

	await benchmark(
		"async-operation/32-values-buffered",
		async () => {
			const operation = new AsyncOperation<number, number>(
				async ({ write }) => {
					for (let value = 1; value <= 32; ++value) {
						await write(value);
					}

					return 33;
				},
				{ strategy },
			);

			for await (const value of operation) {
				sink += value;
			}

			sink += await operation.result;
		},
		{ iterations: 5_000 },
	);

	const largeStrategy = new CountQueuingStrategy({ highWaterMark: 1_024 });

	await benchmark(
		"async-operation/1024-values-buffered",
		async () => {
			const operation = new AsyncOperation<number, number>(
				async ({ write }) => {
					for (let value = 1; value <= 1_024; ++value) {
						await write(value);
					}

					return 1_025;
				},
				{ strategy: largeStrategy },
			);

			for await (const value of operation) {
				sink += value;
			}

			sink += await operation.result;
		},
		{ iterations: 200 },
	);

	await benchmark(
		"async-operation/dispose",
		async () => {
			const operation = new AsyncOperation<never, void>(({ signal }) => {
				return new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
			});

			await operation[Symbol.asyncDispose]();
			++sink;
		},
		{ iterations: 20_000 },
	);

	await benchmark(
		"async-operation/dispose-complete",
		async () => {
			const operation = new AsyncOperation(() => 1);

			sink += await operation.result;
			await operation[Symbol.asyncDispose]();
		},
		{ iterations: 20_000 },
	);

	if (sink === 0) {
		throw new Error("The benchmark did not consume any operation results.");
	}
});
