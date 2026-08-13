import { test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { SignalArray, SignalMap, SignalObject, SignalSet } from "../src/signal-collections.js";

const size = 10_000;
const values = new SignalArray(Array.from({ length: size }, (_value, index) => size - index));
let _sink: unknown;

test("collection hot paths", async () => {
	await benchmark(
		"signal-collections/array-length",
		() => {
			_sink = values.length;
		},
		{ iterations: 1_000_000 },
	);

	await benchmark(
		"signal-collections/array-find-last-10k",
		() => {
			_sink = values.findLast(() => false);
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	await benchmark(
		"signal-collections/array-to-reversed-10k",
		() => {
			_sink = values.toReversed();
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	await benchmark(
		"signal-collections/array-to-sorted-10k",
		() => {
			_sink = values.toSorted((left, right) => left - right);
		},
		{ iterations: 300, samples: 10, warmup: 3 },
	);

	await benchmark(
		"signal-collections/array-with-10k",
		() => {
			_sink = values.with(5_000, 0);
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	await benchmark(
		"signal-collections/map-construction",
		() => {
			_sink = new SignalMap();
		},
		{ iterations: 100_000 },
	);

	await benchmark(
		"signal-collections/set-construction",
		() => {
			_sink = new SignalSet();
		},
		{ iterations: 100_000 },
	);

	await benchmark(
		"signal-collections/object-construction",
		() => {
			_sink = new SignalObject();
		},
		{ iterations: 100_000 },
	);
});
