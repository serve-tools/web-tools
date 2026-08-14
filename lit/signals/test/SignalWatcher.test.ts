import { Signal } from "@serve-tools/signal";
import type { PropertyValues } from "lit";
import { html, LitElement } from "lit";
import { describe, expect, it } from "vitest";
import { SignalWatcher, watch } from "../src/lit-signals.js";

class SignalWatcherTestElement extends SignalWatcher(LitElement) {
	readonly primary = new Signal.State("primary");
	readonly secondary = new Signal.State("secondary");
	readonly status = new Signal.State("idle");
	readonly usePrimary = new Signal.State(true);
	plainValue = "plain";
	renders = 0;

	protected override render() {
		++this.renders;

		return html`
			${this.usePrimary.get() ? this.primary.get() : this.secondary.get()}
			${watch(this.status)}
			${this.plainValue}
		`;
	}
}

customElements.define("serve-tools-signal-watcher-test", SignalWatcherTestElement);

class LifecycleSignalWatcherElement extends SignalWatcher(LitElement) {
	readonly shouldUpdateSignal = new Signal.State(0);
	readonly willUpdateSignal = new Signal.State(0);
	readonly updateSignal = new Signal.State(0);
	readonly renderSignal = new Signal.State(0);
	readonly updatedSignal = new Signal.State(0);
	readonly firstUpdatedSignal = new Signal.State(0);
	readonly controllerUpdateSignal = new Signal.State(0);
	readonly controllerUpdatedSignal = new Signal.State(0);
	renders = 0;

	constructor() {
		super();

		this.addController({
			hostUpdate: () => this.controllerUpdateSignal.get(),
			hostUpdated: () => this.controllerUpdatedSignal.get(),
		});
	}

	protected override shouldUpdate(changedProperties: PropertyValues<this>): boolean {
		this.shouldUpdateSignal.get();

		return super.shouldUpdate(changedProperties);
	}

	protected override willUpdate(changedProperties: PropertyValues<this>): void {
		this.willUpdateSignal.get();
		super.willUpdate(changedProperties);
	}

	protected override update(changedProperties: PropertyValues<this>): void {
		this.updateSignal.get();
		super.update(changedProperties);
	}

	protected override render() {
		++this.renders;

		return this.renderSignal.get();
	}

	protected override updated(changedProperties: PropertyValues<this>): void {
		this.updatedSignal.get();
		super.updated(changedProperties);
	}

	protected override firstUpdated(changedProperties: PropertyValues<this>): void {
		this.firstUpdatedSignal.get();
		super.firstUpdated(changedProperties);
	}
}

customElements.define("serve-tools-lifecycle-signal-watcher-test", LifecycleSignalWatcherElement);

const connect = async (): Promise<SignalWatcherTestElement> => {
	const element = new SignalWatcherTestElement();

	document.body.append(element);
	await element.updateComplete;

	return element;
};

const update = async (element: LitElement): Promise<void> => {
	await Promise.resolve();
	await element.updateComplete;
};

describe("SignalWatcher", () => {
	it("tracks signals across Lit update hooks and reactive controllers", async () => {
		const element = new LifecycleSignalWatcherElement();

		document.body.append(element);
		await element.updateComplete;

		try {
			const firstUpdatedRenders = element.renders;

			expect(Signal.subtle.hasSinks(element.firstUpdatedSignal)).toBe(true);

			element.firstUpdatedSignal.set(1);
			await update(element);

			expect(element.renders).toBe(firstUpdatedRenders + 1);
			expect(Signal.subtle.hasSinks(element.firstUpdatedSignal)).toBe(false);

			const sources = [
				element.shouldUpdateSignal,
				element.willUpdateSignal,
				element.updateSignal,
				element.renderSignal,
				element.updatedSignal,
				element.controllerUpdateSignal,
				element.controllerUpdatedSignal,
			];

			for (const source of sources) {
				const renders = element.renders;

				source.set(source.get() + 1);
				await update(element);

				expect(element.renders).toBe(renders + 1);
			}
		} finally {
			element.remove();
		}
	});

	it("rerenders when a signal read by render changes", async () => {
		const element = await connect();

		try {
			expect(element.shadowRoot?.textContent).toContain("primary");
			expect(element.renders).toBe(1);

			element.primary.set("updated");
			element.primary.set("batched");

			expect(element.shadowRoot?.textContent).toContain("primary");

			await update(element);

			expect(element.shadowRoot?.textContent).toContain("batched");
			expect(element.renders).toBe(2);
		} finally {
			element.remove();
		}
	});

	it("relies directly on Lit's update scheduler", async () => {
		const element = await connect();
		const queuedMicrotasks: VoidFunction[] = [];
		const queueMicrotask = globalThis.queueMicrotask;

		globalThis.queueMicrotask = (callback) => queuedMicrotasks.push(callback);

		try {
			element.primary.set("updated");

			expect(queuedMicrotasks).toHaveLength(0);
		} finally {
			globalThis.queueMicrotask = queueMicrotask;
		}

		try {
			await update(element);

			expect(element.shadowRoot?.textContent).toContain("updated");
		} finally {
			element.remove();
		}
	});

	it("keeps nested watch dependencies out of the component render", async () => {
		const element = await connect();

		try {
			element.status.set("ready");
			await Promise.resolve();

			expect(element.shadowRoot?.textContent).toContain("ready");
			expect(element.renders).toBe(1);

			element.primary.set("outer update");
			await update(element);

			expect(element.shadowRoot?.textContent).toContain("outer update");
			expect(element.renders).toBe(2);
		} finally {
			element.remove();
		}
	});

	it("preserves ordinary Lit updates", async () => {
		const element = await connect();

		try {
			element.plainValue = "lit update";
			element.requestUpdate();

			await element.updateComplete;

			expect(element.shadowRoot?.textContent).toContain("lit update");
			expect(element.renders).toBe(2);
		} finally {
			element.remove();
		}
	});

	it("updates conditional render dependencies", async () => {
		const element = await connect();

		try {
			element.secondary.set("ignored");
			await Promise.resolve();

			expect(element.renders).toBe(1);

			element.usePrimary.set(false);
			await update(element);

			expect(element.shadowRoot?.textContent).toContain("ignored");
			expect(element.renders).toBe(2);

			element.primary.set("still ignored");
			await Promise.resolve();

			expect(element.renders).toBe(2);
		} finally {
			element.remove();
		}
	});

	it("unsubscribes while disconnected and refreshes after reconnecting", async () => {
		const element = await connect();

		element.remove();

		expect(Signal.subtle.hasSinks(element.primary)).toBe(false);

		element.primary.set("disconnected update");

		expect(element.shadowRoot?.textContent).toContain("primary");

		document.body.append(element);
		await element.updateComplete;

		try {
			expect(Signal.subtle.hasSinks(element.primary)).toBe(true);
			expect(element.shadowRoot?.textContent).toContain("disconnected update");
		} finally {
			element.remove();
		}
	});
});
