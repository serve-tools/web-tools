import { Signal } from "@serve-tools/signal";
import { html, nothing, render } from "lit";
import { describe, expect, it } from "vitest";
import { watch } from "../src/lit-signals.js";

describe("watch", () => {
	it("updates only the bound template part", async () => {
		const count = new Signal.State(1);
		const container = document.createElement("div");

		render(html`<p>${watch(count)}</p>`, container);

		expect(container.textContent).toBe("1");

		count.set(2);
		await Promise.resolve();

		expect(container.textContent).toBe("2");
	});

	it("renders computed signals", async () => {
		const count = new Signal.State(2);
		const doubled = new Signal.Computed(() => count.get() * 2);
		const container = document.createElement("div");

		render(html`${watch(doubled)}`, container);

		expect(container.textContent).toBe("4");

		count.set(3);
		await Promise.resolve();

		expect(container.textContent).toBe("6");
	});

	it("renders reactive callbacks with microtask-batched updates", async () => {
		const count = new Signal.State(1);
		const container = document.createElement("div");
		let evaluations = 0;

		render(
			html`${watch(() => {
				++evaluations;

				return html`<p>${count.get()}</p>`;
			})}`,
			container,
		);

		expect(container.textContent).toBe("1");
		expect(evaluations).toBe(1);

		count.set(2);
		count.set(3);

		expect(container.textContent).toBe("1");

		await Promise.resolve();

		expect(container.textContent).toBe("3");
		expect(evaluations).toBe(2);
	});

	it("flushes all invalidated parts in one shared microtask", () => {
		const count = new Signal.State(0);
		const container = document.createElement("div");
		const queuedMicrotasks: VoidFunction[] = [];
		const queueMicrotask = globalThis.queueMicrotask;

		render(html`${Array.from({ length: 64 }, () => watch(count))}`, container);

		globalThis.queueMicrotask = (callback) => queuedMicrotasks.push(callback);

		try {
			count.set(1);

			expect(queuedMicrotasks).toHaveLength(1);
		} finally {
			globalThis.queueMicrotask = queueMicrotask;

			for (const callback of queuedMicrotasks) {
				callback();
			}

			render(nothing, container);
		}
	});

	it("isolates nested reactive callback dependencies", async () => {
		const user = new Signal.State({ name: "Ada" });
		const status = new Signal.State("idle");
		const container = document.createElement("div");
		let outerEvaluations = 0;
		let innerEvaluations = 0;

		render(
			html`${watch(() => {
				++outerEvaluations;

				return html`
					${user.get().name}
					${watch(() => {
						++innerEvaluations;

						return html`${status.get()}`;
					})}
				`;
			})}`,
			container,
		);

		expect(outerEvaluations).toBe(1);
		expect(innerEvaluations).toBe(1);

		status.set("ready");
		await Promise.resolve();

		expect(container.textContent).toContain("Ada");
		expect(container.textContent).toContain("ready");
		expect(outerEvaluations).toBe(1);
		expect(innerEvaluations).toBe(2);

		user.set({ name: "Grace" });
		await Promise.resolve();

		expect(container.textContent).toContain("Grace");
		expect(outerEvaluations).toBe(2);
	});

	it("updates conditional callback dependencies", async () => {
		const usePrimary = new Signal.State(true);
		const primary = new Signal.State("primary");
		const secondary = new Signal.State("secondary");
		const container = document.createElement("div");
		let evaluations = 0;

		render(
			html`${watch(() => {
				++evaluations;

				return usePrimary.get() ? primary.get() : secondary.get();
			})}`,
			container,
		);

		secondary.set("ignored");
		await Promise.resolve();

		expect(container.textContent).toBe("primary");
		expect(evaluations).toBe(1);

		usePrimary.set(false);
		await Promise.resolve();

		expect(container.textContent).toBe("ignored");
		expect(evaluations).toBe(2);

		primary.set("still ignored");
		await Promise.resolve();

		expect(evaluations).toBe(2);

		secondary.set("active");
		await Promise.resolve();

		expect(container.textContent).toBe("active");
		expect(evaluations).toBe(3);
	});

	it("switches its subscription when passed another signal", async () => {
		const first = new Signal.State("first");
		const second = new Signal.State("second");
		const container = document.createElement("div");
		const template = (signal: Signal.Any<string>) => html`${watch(signal)}`;

		render(template(first), container);
		render(template(second), container);

		first.set("ignored");

		expect(container.textContent).toBe("second");

		second.set("updated");
		await Promise.resolve();

		expect(container.textContent).toBe("updated");
	});

	it("unsubscribes when passed no signal", () => {
		const count = new Signal.State(1);
		const container = document.createElement("div");
		const template = (signal?: Signal.Any<number>) => html`${watch(signal)}`;

		render(template(count), container);

		expect(Signal.subtle.hasSinks(count)).toBe(true);

		render(template(), container);

		expect(container.textContent).toBe("");
		expect(Signal.subtle.hasSinks(count)).toBe(false);
	});

	it("unsubscribes when its part is removed", () => {
		const count = new Signal.State(1);
		const container = document.createElement("div");

		render(html`${watch(count)}`, container);

		expect(Signal.subtle.hasSinks(count)).toBe(true);

		render(nothing, container);

		expect(Signal.subtle.hasSinks(count)).toBe(false);
	});

	it("disconnects and reconnects reactive callback subscriptions", () => {
		const count = new Signal.State(1);
		const container = document.createElement("div");
		const part = render(html`${watch(() => count.get())}`, container);

		expect(Signal.subtle.hasSinks(count)).toBe(true);

		part.setConnected(false);
		count.set(2);

		expect(Signal.subtle.hasSinks(count)).toBe(false);
		expect(container.textContent).toBe("1");

		part.setConnected(true);

		expect(Signal.subtle.hasSinks(count)).toBe(true);
		expect(container.textContent).toBe("2");
	});
});
