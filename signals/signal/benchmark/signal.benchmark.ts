import { test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { Signal } from "../src/signal.js";

let _sink: unknown;

test("signal hot paths", async () => {
	await benchmark(
		"signal/state-construction",
		() => {
			_sink = new Signal.State(0);
		},
		{ iterations: 1_000_000 },
	);

	await benchmark(
		"signal/computed-construction",
		() => {
			_sink = new Signal.Computed(() => 0);
		},
		{ iterations: 1_000_000 },
	);

	await benchmark(
		"signal/computed-construction-and-first-get",
		() => {
			const value = new Signal.Computed(() => 0);

			value.get();
			_sink = value;
		},
		{ iterations: 1_000_000 },
	);

	const firstSource = new Signal.State(0);

	await benchmark(
		"signal/computed-construction-and-first-source-get",
		() => {
			const value = new Signal.Computed(() => firstSource.get());

			value.get();
			_sink = value;
		},
		{ iterations: 1_000_000 },
	);

	await benchmark(
		"signal/watcher-construction",
		() => {
			_sink = new Signal.subtle.Watcher(() => undefined);
		},
		{ iterations: 1_000_000 },
	);

	const readState = new Signal.State(1);

	await benchmark(
		"signal/state-get",
		() => {
			_sink = readState.get();
		},
		{ iterations: 10_000_000 },
	);

	const equalState = new Signal.State(1);

	await benchmark(
		"signal/state-set-equal",
		() => {
			equalState.set(1);
		},
		{ iterations: 10_000_000 },
	);

	const writeState = new Signal.State(0);
	let writeValue = 0;

	await benchmark(
		"signal/state-set-changing",
		() => {
			writeState.set(++writeValue);
		},
		{ iterations: 10_000_000 },
	);

	const computedState = new Signal.State(1);
	const computed = new Signal.Computed(() => computedState.get() * 2);

	computed.get();

	await benchmark(
		"signal/computed-get-cached",
		() => {
			_sink = computed.get();
		},
		{ iterations: 10_000_000 },
	);

	let computedValue = 1;

	await benchmark(
		"signal/computed-update",
		() => {
			computedState.set(++computedValue);
			_sink = computed.get();
		},
		{ iterations: 1_000_000 },
	);

	const wideSources = Array.from({ length: 1_000 }, () => new Signal.State(1));
	const unrelated = new Signal.State(0);
	const wideComputed = new Signal.Computed(() => {
		let total = 0;

		for (const source of wideSources) {
			total += source.get();
		}

		return total;
	});

	wideComputed.get();

	await benchmark(
		"signal/computed-1k-sources-after-unrelated-write",
		() => {
			unrelated.set(unrelated.get() + 1);
			_sink = wideComputed.get();
		},
		{ iterations: 100_000, samples: 10, warmup: 3 },
	);

	const fanoutState = new Signal.State(0);
	const watchers = Array.from({ length: 1_000 }, () => new Signal.subtle.Watcher(() => undefined));

	for (const watcher of watchers) {
		watcher.watch(fanoutState);
	}

	let fanoutValue = 0;

	await benchmark(
		"signal/state-set-1k-watchers",
		() => {
			for (const watcher of watchers) {
				watcher.watch();
			}

			fanoutState.set(++fanoutValue);
		},
		{ iterations: 10_000, samples: 10, warmup: 3 },
	);

	const watchedSources = Array.from({ length: 1_000 }, () => new Signal.State(0));
	const watcher = new Signal.subtle.Watcher(() => undefined);

	await benchmark(
		"signal/watcher-cycle-1k-sources",
		() => {
			watcher.watch(...watchedSources);
			watcher.unwatch(...watchedSources);
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	const fanoutSource = new Signal.State(0);
	const fanoutWatchers = Array.from({ length: 1_000 }, () => new Signal.subtle.Watcher(() => undefined));

	await benchmark(
		"signal/watcher-cycle-1k-sinks",
		() => {
			for (const fanoutWatcher of fanoutWatchers) {
				fanoutWatcher.watch(fanoutSource);
			}

			for (const fanoutWatcher of fanoutWatchers) {
				fanoutWatcher.unwatch(fanoutSource);
			}
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);
});
