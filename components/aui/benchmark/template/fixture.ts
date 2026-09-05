import { AUIElement } from "@serve-tools/aui/base";
import { Signal } from "@serve-tools/signal";
import { html, PersistentFragment } from "@serve-tools/signal-dom/template";

const check = (condition: unknown, message: string): void => {
	if (!condition) {
		throw new Error(message);
	}
};

const tick = (): Promise<void> => new Promise(queueMicrotask);

class Counter extends AUIElement {
	count = new Signal.State(0);
	disabled = new Signal.State(false);
	button!: HTMLButtonElement;
	input!: HTMLInputElement;

	increment(): void {
		this.count.set(this.count.get() + 1);
	}

	override connectedCallback(): void {
		super.connectedCallback();

		this.button ??= this.querySelector("button")!;
		this.input ??= this.querySelector("input")!;
	}

	protected override layout() {
		return html`<label><input aria-label="Edit" .value=${"initial"} .disabled=${this.disabled}><button type="button" @click=${this.increment}>${this.count}</button></label>`;
	}
}

customElements.define("benchmark-template-counter", Counter);

class RegionHost extends AUIElement {
	rows = ["A", "B", "C"].map((name) => {
		const input = this.ownerDocument.createElement("input");
		input.setAttribute("aria-label", name);
		input.value = name;

		return { input, region: new PersistentFragment([input]) };
	});
	order = new Signal.State(this.rows.map(({ region }) => region));

	protected override layout() {
		return html`<section>${this.order}</section>`;
	}
}

customElements.define("benchmark-template-regions", RegionHost);

let directiveElement: Element | undefined;
let directiveSetupCount = 0;
let directiveCleanupCount = 0;
let eventOwnerMatched = false;

class PublicContractProbe extends AUIElement {
	value = new Signal.State(0);
	button!: HTMLButtonElement;

	#reference = (element: Element): (() => void) => {
		directiveElement = element;
		++directiveSetupCount;

		return () => {
			++directiveCleanupCount;
		};
	};

	#activate(): void {
		eventOwnerMatched = this === (directiveElement?.getRootNode() as ShadowRoot | undefined)?.host;
	}

	override connectedCallback(): void {
		super.connectedCallback();

		this.button ??= this.shadowRoot!.querySelector("button")!;
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}

	protected override layout() {
		return html`<button ${this.#reference} @click=${this.#activate}>${this.value}</button>`;
	}
}

customElements.define("benchmark-template-public-contract", PublicContractProbe);

const root = document.body.appendChild(document.createElement("main"));
let counters: Counter[] = [];
let regions: RegionHost | undefined;
let workload = "";
let expectedCount = 0;
let expectedDisabled = false;
let expectedOrder = "ABC";
let expectedHidden = false;

const assertSuspended = (counter: Counter): void => {
	check(Signal.subtle.introspectSinks(counter.count).length === 0, "Detached count binding remained active");
	check(Signal.subtle.introspectSinks(counter.disabled).length === 0, "Detached property binding remained active");
};

const cleanup = (): void => {
	const retiredCounters = counters;
	const retiredRegions = regions;

	root.replaceChildren();

	for (const counter of retiredCounters) {
		assertSuspended(counter);
	}
	if (retiredRegions) {
		check(
			Signal.subtle.introspectSinks(retiredRegions.order).length === 0,
			"Detached region binding remained active",
		);
	}

	counters = [];
	regions = undefined;
};

const createCounters = (count: number): void => {
	const content = document.createDocumentFragment();

	for (let index = 0; index < count; ++index) {
		const counter = document.createElement("benchmark-template-counter") as Counter;

		counters.push(counter);
		content.append(counter);
	}

	root.append(content);
};

const prepare = (next: string): void => {
	cleanup();

	workload = next;
	expectedCount = 0;
	expectedDisabled = false;
	expectedOrder = "ABC";
	expectedHidden = false;

	if (next === "update" || next === "reconnect") {
		createCounters(1);
	}

	if (next === "move") {
		regions = document.createElement("benchmark-template-regions") as RegionHost;
		root.append(regions);
		regions.rows[0]!.input.value = "edited-A";
	}
};

const run = async (next: string, iterations: number): Promise<{ ms: number; operations: number }> => {
	prepare(next);

	const start = performance.now();

	if (next === "first-mount" || next === "mount-1000") {
		const count = next === "first-mount" ? 1 : 1_000;

		createCounters(count);
		check(root.childElementCount === count && counters.at(-1)!.button.textContent === "0", "Mount invariant");

		return { ms: performance.now() - start, operations: count };
	}

	if (next === "update") {
		const counter = counters[0]!;

		for (let index = 0; index < iterations; ++index) {
			counter.count.set(++expectedCount);
			expectedDisabled = !expectedDisabled;
			counter.disabled.set(expectedDisabled);
			await tick();
			check(
				counter.button.textContent === String(expectedCount) && counter.input.disabled === expectedDisabled,
				"Update invariant",
			);
		}
	} else if (next === "reconnect") {
		const counter = counters[0]!;
		const input = counter.input;

		input.value = "edited";

		for (let index = 0; index < iterations; ++index) {
			counter.remove();
			assertSuspended(counter);
			counter.count.set(++expectedCount);
			root.append(counter);
			check(
				counter.button.textContent === String(expectedCount) &&
					counter.input === input &&
					input.value === "edited",
				"Reconnect invariant",
			);
		}
	} else if (next === "move") {
		const host = regions!;

		for (let index = 0; index < iterations; ++index) {
			host.order.set([...host.order.get()].reverse());
			expectedOrder = expectedOrder === "ABC" ? "CBA" : "ABC";
			host.rows[0]!.region.hidden = !host.rows[0]!.region.hidden;
			expectedHidden = !expectedHidden;
			await tick();
			check(
				host.rows[0]!.input.value === "edited-A" &&
					host.order.get()[0] === host.rows[expectedOrder === "ABC" ? 0 : 2]!.region,
				"Move invariant",
			);
		}
	} else {
		throw new Error(`Unknown workload: ${next}`);
	}

	return { ms: performance.now() - start, operations: iterations };
};

const validate = () => {
	if (regions) {
		const inputs = [...regions.querySelectorAll("input")];
		const visibleOrder = inputs.map((input) => input.getAttribute("aria-label")).join("");

		check(visibleOrder === (expectedHidden ? expectedOrder.replace("A", "") : expectedOrder), "Full region order");
		check(
			regions.rows.every(({ input, region }) => region.nodes.includes(input)),
			"Region identity",
		);
		check(regions.rows[0]!.input.value === "edited-A", "Region edit retention");

		return { workload, count: 3, visibleOrder, edited: regions.rows[0]!.input.value, hidden: expectedHidden };
	}

	for (const counter of counters) {
		check(counter.button.textContent === String(expectedCount), "Full text output");
		check(counter.input.disabled === expectedDisabled, "Full property output");
		check(counter.input.value === (workload === "reconnect" ? "edited" : "initial"), "Full input value");
		check(counter.isConnected, "Counter connectivity");
		check(
			counter.querySelectorAll("label").length === 1 &&
				counter.querySelectorAll("button").length === 1 &&
				counter.querySelectorAll("input").length === 1,
			"Full element shape",
		);
		check(Signal.subtle.introspectSinks(counter.count).length === 1, "One active count binding");
		check(Signal.subtle.introspectSinks(counter.disabled).length === 1, "One active property binding");
	}

	check(root.childElementCount === counters.length, "Full host count");

	return {
		workload,
		count: counters.length,
		value: expectedCount,
		disabled: expectedDisabled,
		elements: root.querySelectorAll("*").length,
	};
};

const validatePublicContract = async () => {
	directiveElement = undefined;
	directiveSetupCount = 0;
	directiveCleanupCount = 0;
	eventOwnerMatched = false;

	const probe = document.createElement("benchmark-template-public-contract") as PublicContractProbe;

	root.append(probe);
	check(probe.button === directiveElement, "Returned-template directive did not capture the expected button");
	probe.button.click();
	check(eventOwnerMatched, "Returned-template event did not receive the host as this");

	probe.value.set(1);
	await tick();
	check(probe.button.textContent === "1", "Returned-template signal did not update");

	probe.remove();
	check(
		Signal.subtle.introspectSinks(probe.value).length === 0,
		"Returned-template signal remained active while detached",
	);
	probe.value.set(2);
	await tick();
	check(probe.button.textContent === "1", "Detached returned-template signal changed DOM");

	root.append(probe);
	check(probe.button.textContent === "2", "Returned-template signal did not reconcile on reconnect");
	check(directiveSetupCount === 1, "Returned-template directive ran more than once");
	check(directiveCleanupCount === 0, "Disconnect unexpectedly retired the returned template");

	probe.remove();
	check(Signal.subtle.introspectSinks(probe.value).length === 0, "Final probe removal did not suspend its binding");

	return {
		directiveCleanupCount,
		directiveSetupCount,
		eventOwnerMatched,
		reconnectedValue: probe.button.textContent,
		terminalDisposeAvailable: false,
	};
};

Object.assign(globalThis, { __templateBenchmark: { run, validate, cleanup, validatePublicContract } });
