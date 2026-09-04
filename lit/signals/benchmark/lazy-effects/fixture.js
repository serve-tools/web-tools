import { SignalWatcher } from "@serve-tools/lit-signals";
import { Signal } from "@serve-tools/signal";
import { LitElement } from "lit";
import { benchmark } from "../../../../client/benchmark.js";

const TAG_NAME = "benchmark-lazy-effect-signal-watcher";
const EFFECT_TAG_NAME = "benchmark-one-effect-signal-watcher";
const source = new Signal.State(0);
let sink = 0;

class BenchmarkSignalWatcherElement extends SignalWatcher(LitElement) {
	updateCount = 0;

	render() {
		++this.updateCount;
		return source.get();
	}
}

class BenchmarkEffectElement extends BenchmarkSignalWatcherElement {
	effectRuns = 0;

	constructor() {
		super();
		this.updateEffect(() => {
			source.get();
			++this.effectRuns;
		});
	}
}

customElements.define(TAG_NAME, BenchmarkSignalWatcherElement);
customElements.define(EFFECT_TAG_NAME, BenchmarkEffectElement);

const root = document.createElement("div");
document.body.append(root);

const assertRendered = (elements, expected, expectedUpdateCount, context) => {
	const first = elements[0];
	const last = elements.at(-1);
	if (
		root.childElementCount !== elements.length ||
		first?.shadowRoot?.textContent !== expected ||
		last?.shadowRoot?.textContent !== expected ||
		first.updateCount !== expectedUpdateCount ||
		last.updateCount !== expectedUpdateCount
	) {
		throw new Error(
			`SignalWatcher ${context} sink changed: children=${root.childElementCount}, text=${first?.shadowRoot?.textContent}/${last?.shadowRoot?.textContent}, updates=${first?.updateCount}/${last?.updateCount}, expected=${expected}/${expectedUpdateCount}`,
		);
	}
	sink += elements.length + (first?.updateCount ?? 0) + (last?.updateCount ?? 0);
};

const mountLifecycle = async () => {
	const elements = Array.from({ length: 100 }, () => new BenchmarkSignalWatcherElement());
	root.append(...elements);
	await elements.at(-1).updateComplete;
	assertRendered(elements, String(source.get()), 1, "effect-free mount");

	for (const element of elements) {
		element.remove();
	}
	await Promise.resolve();
	if (root.childElementCount !== 0) {
		throw new Error("SignalWatcher teardown sink changed");
	}
};

const mountEffectLifecycle = async () => {
	const elements = Array.from({ length: 100 }, () => new BenchmarkEffectElement());
	root.append(...elements);
	await elements.at(-1).updateComplete;
	assertRendered(elements, String(source.get()), 1, "one-effect mount");
	if (elements[0]?.effectRuns !== 1 || elements.at(-1)?.effectRuns !== 1) {
		throw new Error("SignalWatcher effect sink changed");
	}
	sink += elements[0].effectRuns + elements.at(-1).effectRuns;

	for (const element of elements) {
		element.remove();
	}
	await Promise.resolve();
	if (root.childElementCount !== 0) {
		throw new Error("SignalWatcher effect teardown sink changed");
	}
};

const mountDenseElements = async () => {
	const elements = Array.from({ length: 1_000 }, () => new BenchmarkSignalWatcherElement());
	root.append(...elements);
	await elements.at(-1).updateComplete;
	assertRendered(elements, String(source.get()), 1, "dense mount");
	return elements;
};

const releaseDenseElements = async (elements) => {
	for (const element of elements) {
		element.remove();
	}
	await Promise.resolve();
};

globalThis.__validateLazyEffectBenchmark = async () => {
	await mountLifecycle();
	await mountEffectLifecycle();
	const elements = await mountDenseElements();
	const expectedUpdateCount = elements[0].updateCount + 1;
	source.set(source.get() + 1);
	await elements.at(-1).updateComplete;
	assertRendered(elements, String(source.get()), expectedUpdateCount, "dense update");
	await releaseDenseElements(elements);
	return sink;
};

const benchmarkEffectFreeMount = () =>
	benchmark("lit-signals/mount-update-dispose-100-effect-free-watchers", mountLifecycle, {
		iterations: 100,
		samples: 15,
		warmup: 5,
	});

const benchmarkOneEffectMount = () =>
	benchmark("lit-signals/mount-update-dispose-100-one-effect-watchers", mountEffectLifecycle, {
		iterations: 100,
		samples: 15,
		warmup: 5,
	});

const benchmarkDenseUpdate = async () => {
	const elements = await mountDenseElements();

	try {
		return await benchmark(
			"lit-signals/update-1k-effect-free-watchers",
			async () => {
				const expectedUpdateCount = elements[0].updateCount + 1;
				source.set(source.get() + 1);
				await elements.at(-1).updateComplete;
				assertRendered(elements, String(source.get()), expectedUpdateCount, "dense update");
			},
			{ iterations: 100, samples: 15, warmup: 5 },
		);
	} finally {
		await releaseDenseElements(elements);
	}
};

const workloadRunners = {
	"effect-free-mount": benchmarkEffectFreeMount,
	"one-effect-mount": benchmarkOneEffectMount,
	"dense-update": benchmarkDenseUpdate,
};

globalThis.__runLazyEffectBenchmarks = async (workload) => {
	if (workload !== undefined) {
		const run = workloadRunners[workload];
		if (run === undefined) {
			throw new Error(`Unknown lazy effect workload: ${workload}`);
		}

		return [await run()];
	}

	const results = [];
	for (const run of Object.values(workloadRunners)) {
		results.push(await run());
	}

	return results;
};
