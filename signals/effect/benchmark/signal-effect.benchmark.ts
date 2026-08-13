import { Signal } from "@serve-tools/signal";
import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { createEffect, effect } from "../src/signal-effect.js";

const microtask = () => new Promise<void>(queueMicrotask);

let _sink: unknown;

test("effect lifecycle hot paths", async () => {
	const source = new Signal.State(0);

	await benchmark(
		"signal-effect/effect-create-run-dispose",
		() => {
			const dispose = effect(() => source.get());

			dispose();
		},
		{ iterations: 100_000 },
	);

	await benchmark(
		"signal-effect/controller-create-dispose-dormant",
		() => {
			const controller = createEffect(() => source.get());

			controller.dispose();
		},
		{ iterations: 100_000 },
	);

	await benchmark(
		"signal-effect/controller-create-start-dispose",
		() => {
			const controller = createEffect(() => source.get());

			controller.start();
			controller.dispose();
		},
		{ iterations: 100_000 },
	);

	const mountedDisposers = Array.from({ length: 10_239 }, () => effect(() => source.get()));

	await benchmark(
		"signal-effect/effect-create-run-dispose-among-10k-active",
		() => {
			const dispose = effect(() => source.get());

			dispose();
		},
		{ iterations: 100_000, samples: 10, warmup: 3 },
	);

	for (const dispose of mountedDisposers) {
		dispose();
	}
});

test("effect scheduling hot paths", async () => {
	const source = new Signal.State(0);

	let observed = 0;
	let nextValue = 0;

	const dispose = effect(() => (observed = source.get()));

	await benchmark(
		"signal-effect/single-effect-update",
		async () => {
			source.set(++nextValue);
			await microtask();
		},
		{ iterations: 10_000, samples: 10, warmup: 3 },
	);

	expect(observed).toBe(nextValue);

	dispose();

	const fanoutSource = new Signal.State(0);

	let fanoutRuns = 0;

	const fanoutDisposers = Array.from({ length: 1_000 }, () =>
		effect(() => {
			fanoutSource.get();

			++fanoutRuns;
		}),
	);

	let nextFanout = 0;

	await benchmark(
		"signal-effect/update-1k-effects",
		async () => {
			fanoutSource.set(++nextFanout);
			await microtask();
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	expect(fanoutRuns).toBeGreaterThan(1_000);

	for (const disposeFanout of fanoutDisposers) {
		disposeFanout();
	}
});

test("reuses fragmented scheduler capacity", async () => {
	const source = new Signal.State(0);
	const disposers = Array.from({ length: 10_000 }, () => effect(() => source.get()));
	const churnSlots = Array.from({ length: 20 }, (_, index) => index * 512);

	await benchmark(
		"signal-effect/reuse-fragmented-scheduler-capacity",
		() => {
			for (const slot of churnSlots) disposers[slot]();
			for (const slot of churnSlots) disposers[slot] = effect(() => source.get());
		},
		{ iterations: 5_000, samples: 10, warmup: 3 },
	);

	for (const dispose of disposers) {
		dispose();
	}
});

test("sparse scheduling among many active effects", async () => {
	const sources = Array.from({ length: 10_000 }, () => new Signal.State(0));
	const observed = new Uint32Array(sources.length);
	const disposers = sources.map((source, index) => effect(() => (observed[index] = source.get())));

	let nextValue = 0;

	await benchmark(
		"signal-effect/sparse-update-among-10k-effects",
		async () => {
			sources[5_000].set(++nextValue);
			await microtask();
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	expect(observed[5_000]).toBe(nextValue);

	for (const dispose of disposers) {
		dispose();
	}

	_sink = observed;
});
