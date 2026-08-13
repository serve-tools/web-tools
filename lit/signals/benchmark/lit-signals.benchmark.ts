import { Signal } from "@serve-tools/signal";
import { html, LitElement, nothing, render } from "lit";
import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { computed, property } from "../src/decorators.js";
import { SignalWatcher, watch } from "../src/lit-signals.js";

const microtask = () => new Promise<void>(queueMicrotask);
const componentSource = new Signal.State(0);

class BenchmarkSignalWatcherElement extends SignalWatcher(LitElement) {
	protected override render() {
		return componentSource.get();
	}
}

customElements.define("serve-tools-benchmark-signal-watcher", BenchmarkSignalWatcherElement);

const atomicState = Symbol();
const lifecycleState = Symbol();
const computedInitializers: Array<(this: BenchmarkDecoratedModel) => void> = [];

class BenchmarkDecoratedModel {
	declare [atomicState]: number;
	declare [lifecycleState]: number;

	constructor() {
		this[atomicState] = atomicProperty.init!.call(this, 0);
		this[lifecycleState] = lifecycleProperty.init!.call(this, 0);

		for (const initialize of computedInitializers) initialize.call(this);
	}

	get atomicValue(): number {
		return atomicProperty.get!.call(this);
	}

	set atomicValue(value: number) {
		atomicProperty.set!.call(this, value);
	}

	get lifecycleValue(): number {
		return lifecycleProperty.get!.call(this);
	}

	set lifecycleValue(value: number) {
		lifecycleProperty.set!.call(this, value);
	}

	get doubled(): number {
		return computedDoubled.call(this);
	}

	requestUpdate(): void {}
}

const decoratorContext = (name: string): ClassAccessorDecoratorContext<BenchmarkDecoratedModel, number> => ({
	kind: "accessor",
	name,
	static: false,
	private: false,
	access: {
		has: (model) => name in model,
		get: (model) => model[name as "atomicValue"],
		set: (model, value) => (model[name as "atomicValue"] = value),
	},
	addInitializer() {},
	metadata: {},
});

const atomicProperty = property<number>()(
	{
		get() {
			return this[atomicState];
		},
		set(value) {
			this[atomicState] = value;
		},
	},
	decoratorContext("atomicValue"),
);
const lifecycleProperty = property<number>({ update: "lifecycle" })(
	{
		get() {
			return this[lifecycleState];
		},
		set(value) {
			this[lifecycleState] = value;
		},
	},
	decoratorContext("lifecycleValue"),
);
const computedDoubled = computed<BenchmarkDecoratedModel, number>(
	function () {
		return this.atomicValue * 2;
	},
	{
		kind: "getter",
		name: "doubled",
		static: false,
		private: false,
		access: {
			has: (model) => "doubled" in model,
			get: (model) => model.doubled,
		},
		addInitializer: (initialize) => computedInitializers.push(initialize),
		metadata: {},
	},
);

test("decorator construction and write hot paths", async () => {
	let model = new BenchmarkDecoratedModel();

	await benchmark(
		"lit-signals/construct-and-read-decorated-model",
		() => {
			model = new BenchmarkDecoratedModel();
			model.doubled;
		},
		{ iterations: 100_000 },
	);

	let nextAtomic = 0;

	await benchmark(
		"lit-signals/atomic-property-write",
		() => {
			model.atomicValue = ++nextAtomic;
		},
		{ iterations: 1_000_000 },
	);

	let nextLifecycle = 0;

	await benchmark(
		"lit-signals/lifecycle-property-write",
		() => {
			model.lifecycleValue = ++nextLifecycle;
		},
		{ iterations: 1_000_000 },
	);

	expect(model.atomicValue).toBe(nextAtomic);
	expect(model.lifecycleValue).toBe(nextLifecycle);
});

test("watch lifecycle and parent render hot paths", async () => {
	const source = new Signal.State(0);
	const container = document.createElement("div");
	const sources = Array.from({ length: 100 }, () => new Signal.State(0));
	const mounted = html`${sources.map((value) => watch(value))}`;

	await benchmark(
		"lit-signals/mount-dispose-100-watch-regions",
		() => {
			render(mounted, container);
			render(nothing, container);
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	const renderDirect = () => {
		render(html`${watch(source)}`, container);
	};
	const renderCallback = () => {
		render(html`${watch(() => source.get())}`, container);
	};

	renderDirect();

	await benchmark("lit-signals/parent-render-stable-signal-watch", renderDirect, {
		iterations: 100_000,
		samples: 10,
		warmup: 3,
	});

	render(nothing, container);
	renderCallback();

	await benchmark("lit-signals/parent-render-inline-callback-watch", renderCallback, {
		iterations: 100_000,
		samples: 10,
		warmup: 3,
	});

	render(nothing, container);
});

test("watch sparse and dense invalidation hot paths", async () => {
	const sparseSources = Array.from({ length: 10_000 }, () => new Signal.State(0));
	const sparseContainer = document.createElement("div");

	render(html`${sparseSources.map((source) => watch(source))}`, sparseContainer);

	let sparseValue = 0;

	await benchmark(
		"lit-signals/sparse-update-among-10k-watch-regions",
		async () => {
			sparseSources[5_000].set(++sparseValue);
			await microtask();
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	expect(sparseContainer.textContent).toContain(String(sparseValue));
	render(nothing, sparseContainer);

	const denseSource = new Signal.State(0);
	const denseContainer = document.createElement("div");

	render(html`${Array.from({ length: 1_000 }, () => watch(denseSource))}`, denseContainer);

	let denseValue = 0;

	await benchmark(
		"lit-signals/update-1k-watch-regions",
		async () => {
			denseSource.set(++denseValue);
			await microtask();
		},
		{ iterations: 500, samples: 10, warmup: 3 },
	);

	expect(denseContainer.textContent).toContain(String(denseValue));
	render(nothing, denseContainer);
});

test("SignalWatcher lifecycle and dense invalidation hot paths", async () => {
	const mountContainer = document.createElement("div");

	document.body.append(mountContainer);

	await benchmark(
		"lit-signals/mount-update-dispose-100-signal-watcher-elements",
		async () => {
			const elements = Array.from({ length: 100 }, () => new BenchmarkSignalWatcherElement());

			mountContainer.append(...elements);
			await elements.at(-1)!.updateComplete;
			for (const element of elements) element.remove();
		},
		{ iterations: 10, samples: 5, warmup: 2 },
	);

	const elements = Array.from({ length: 1_000 }, () => new BenchmarkSignalWatcherElement());

	mountContainer.append(...elements);
	await elements.at(-1)!.updateComplete;

	let nextValue = 0;

	await benchmark(
		"lit-signals/update-1k-signal-watcher-elements",
		async () => {
			componentSource.set(++nextValue);
			await elements.at(-1)!.updateComplete;
		},
		{ iterations: 20, samples: 5, warmup: 2 },
	);

	expect(elements[0].shadowRoot?.textContent).toBe(String(nextValue));
	for (const element of elements) element.remove();
	mountContainer.remove();
});
