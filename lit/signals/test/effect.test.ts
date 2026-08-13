import { Signal } from "@serve-tools/signal";
import { html, LitElement } from "lit";
import { describe, expect, it } from "vitest";
import { effect } from "../src/decorators.js";
import { SignalWatcher } from "../src/lit-signals.js";

class EffectTestElement extends SignalWatcher(LitElement) {
	readonly rendered = new Signal.State(0);
	readonly effectOnly = new Signal.State(0);
	readonly events: string[] = [];
	renders = 0;

	constructor() {
		super();

		this.updateEffect(
			() => {
				const value = this.rendered.get();

				this.events.push(`before:${value}`);

				return () => this.events.push(`cleanup-before:${value}`);
			},
			{ phase: "before-update" },
		);

		this.updateEffect(() => {
			const value = this.rendered.get();

			this.events.push(`after:${value}`);

			return () => this.events.push(`cleanup-after:${value}`);
		});

		initializeDecoratedEffect.call(this);
	}

	decoratedEffect(): void {
		this.events.push(`decorated:${this.effectOnly.get()}`);
	}

	protected override render() {
		const value = this.rendered.get();

		++this.renders;
		this.events.push(`render:${value}`);

		return html`${value}`;
	}
}

const effectInitializers: Array<(this: EffectTestElement) => void> = [];

effect<EffectTestElement>()(EffectTestElement.prototype.decoratedEffect, {
	kind: "method",
	name: "decoratedEffect",
	static: false,
	private: false,
	access: {
		has: (element) => "decoratedEffect" in element,
		get: (element) => element.decoratedEffect,
	},
	addInitializer: (initializer) => effectInitializers.push(initializer),
	metadata: {},
});

function initializeDecoratedEffect(this: EffectTestElement): void {
	for (const initialize of effectInitializers) initialize.call(this);
}

customElements.define("serve-tools-effect-test", EffectTestElement);

const connect = async (): Promise<EffectTestElement> => {
	const element = new EffectTestElement();

	document.body.append(element);
	await element.updateComplete;

	return element;
};

describe("signal update effects", () => {
	it("orders effects around a pending Lit update", async () => {
		const element = await connect();

		try {
			expect(element.events.slice(0, 4)).toEqual(["before:0", "render:0", "after:0", "decorated:0"]);

			element.events.length = 0;
			element.rendered.set(1);
			await Promise.resolve();
			await element.updateComplete;

			expect([...element.events]).toEqual([
				"cleanup-before:0",
				"before:1",
				"render:1",
				"cleanup-after:0",
				"after:1",
			]);
		} finally {
			element.remove();
		}
	});

	it("runs effect-only invalidations without rerendering the host", async () => {
		const element = await connect();

		try {
			const renders = element.renders;

			element.events.length = 0;
			element.effectOnly.set(1);
			await Promise.resolve();

			expect(element.events).toEqual(["decorated:1"]);
			expect(element.renders).toBe(renders);
		} finally {
			element.remove();
		}
	});

	it("cleans up while disconnected and restarts after reconnection", async () => {
		const element = await connect();

		element.events.length = 0;
		element.remove();
		await Promise.resolve();

		expect(element.events).toEqual(["cleanup-before:0", "cleanup-after:0"]);
		expect(Signal.subtle.hasSinks(element.rendered)).toBe(false);

		element.rendered.set(2);
		document.body.append(element);
		await element.updateComplete;

		try {
			expect(element.events).toContain("before:2");
			expect(element.events).toContain("render:2");
			expect(element.events).toContain("after:2");
		} finally {
			element.remove();
		}
	});

	it("returns an idempotent manual disposer", async () => {
		const source = new Signal.State(0);
		const element = await connect();
		const values: number[] = [];
		let cleanups = 0;
		const dispose = element.updateEffect(() => {
			values.push(source.get());

			return () => ++cleanups;
		});

		await Promise.resolve();
		dispose();
		dispose();
		source.set(1);
		await Promise.resolve();

		try {
			expect(values).toEqual([0]);
			expect(cleanups).toBe(1);
		} finally {
			element.remove();
		}
	});

	it("does not tear effects down during a same-task DOM move", async () => {
		const element = await connect();

		element.events.length = 0;
		element.remove();
		document.body.append(element);
		await Promise.resolve();

		try {
			expect(element.events).not.toContain("cleanup-before:0");
			expect(element.events).not.toContain("cleanup-after:0");
		} finally {
			element.remove();
		}
	});

	it("keeps manually disposed effects active while disconnected", async () => {
		const source = new Signal.State(0);
		const element = await connect();
		const values: number[] = [];
		const dispose = element.updateEffect(
			() => {
				values.push(source.get());
			},
			{ manualDispose: true },
		);

		await Promise.resolve();
		element.remove();
		await Promise.resolve();

		source.set(1);
		await Promise.resolve();

		expect(values).toEqual([0, 1]);
		expect(Signal.subtle.hasSinks(source)).toBe(true);

		dispose();

		expect(Signal.subtle.hasSinks(source)).toBe(false);
	});
});
