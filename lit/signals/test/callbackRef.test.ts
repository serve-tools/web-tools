import { nothing, render } from "lit";
import { ref } from "lit/directives/ref.js";
import { describe, expect, it, vi } from "vitest";

import { callbackRef, html } from "../src/lit-signals.js";

describe("callbackRef", () => {
	it("sets up and cleans up distinct elements", () => {
		const setups: Element[] = [];
		const cleanups: Element[] = [];
		const elementRef = callbackRef((element) => {
			setups.push(element);

			return () => cleanups.push(element);
		});
		const container = document.createElement("div");

		render(html`<button ${ref(elementRef)}></button>`, container);

		const button = container.querySelector("button")!;

		expect(elementRef.value).toBe(button);
		expect(setups).toEqual([button]);

		render(html`<input ${ref(elementRef)} />`, container);

		const input = container.querySelector("input")!;

		expect(elementRef.value).toBe(input);
		expect(setups).toEqual([button, input]);
		expect(cleanups).toEqual([button]);

		render(nothing, container);

		expect(elementRef.value).toBeUndefined();
		expect(cleanups).toEqual([button, input]);
	});

	it("does not repeat setup for an unchanged element", () => {
		const setup = vi.fn();
		const elementRef = callbackRef(setup);
		const container = document.createElement("div");
		const template = () => html`<button ${ref(elementRef)}></button>`;

		render(template(), container);
		render(template(), container);

		expect(setup).toHaveBeenCalledOnce();
	});

	it("waits for connection and follows Lit disconnection", async () => {
		const setup = vi.fn(() => vi.fn());
		const elementRef = callbackRef(setup, { waitUntilConnected: true });
		const container = document.createElement("div");
		const part = render(html`<button ${ref(elementRef)}></button>`, container);

		expect(elementRef.value).toBeInstanceOf(HTMLButtonElement);
		expect(setup).not.toHaveBeenCalled();

		document.body.append(container);
		await new Promise(requestAnimationFrame);

		expect(setup).toHaveBeenCalledOnce();

		const firstCleanup = setup.mock.results[0]!.value;

		part.setConnected(false);

		expect(elementRef.value).toBeUndefined();
		expect(firstCleanup).toHaveBeenCalledOnce();

		part.setConnected(true);

		expect(setup).toHaveBeenCalledTimes(2);

		render(nothing, container);
		container.remove();
	});

	it("cancels pending setup when the ref is cleared", async () => {
		const setup = vi.fn();
		const elementRef = callbackRef(setup, { waitUntilConnected: true });
		const container = document.createElement("div");

		render(html`<button ${ref(elementRef)}></button>`, container);
		render(nothing, container);
		document.body.append(container);
		await new Promise(requestAnimationFrame);

		expect(setup).not.toHaveBeenCalled();

		container.remove();
	});

	it("immediately cleans up setup invalidated by its callback", () => {
		const cleanup = vi.fn();
		let elementRef: callbackRef.Result<HTMLButtonElement>;

		elementRef = callbackRef(() => {
			(elementRef as { value: HTMLButtonElement | undefined }).value = undefined;

			return cleanup;
		});

		const container = document.createElement("div");

		render(html`<button ${ref(elementRef)}></button>`, container);

		expect(elementRef.value).toBeUndefined();
		expect(cleanup).toHaveBeenCalledOnce();
	});
});
