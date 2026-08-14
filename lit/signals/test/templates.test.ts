import { Signal } from "@serve-tools/signal";
import { nothing, render } from "lit";
import { describe, expect, it, vi } from "vitest";

import { html, svg } from "../src/lit-signals.js";

describe("signal-native templates", () => {
	it("updates direct Signal substitutions in HTML parts", async () => {
		const disabled = new Signal.State(false);
		const label = new Signal.State("Ready");
		const title = new Signal.Computed(() => `${label.get()} button`);
		const container = document.createElement("div");

		render(html`<button title=${title} ?disabled=${disabled}>${label}</button>`, container);

		const button = container.querySelector("button")!;

		expect(button.title).toBe("Ready button");
		expect(button.disabled).toBe(false);
		expect(button.textContent).toBe("Ready");

		label.set("Working");
		disabled.set(true);
		await Promise.resolve();

		expect(button.title).toBe("Working button");
		expect(button.disabled).toBe(true);
		expect(button.textContent).toBe("Working");

		render(nothing, container);

		expect(Signal.subtle.hasSinks(label)).toBe(false);
		expect(Signal.subtle.hasSinks(title)).toBe(false);
		expect(Signal.subtle.hasSinks(disabled)).toBe(false);
	});

	it("preserves ordinary Lit substitutions", () => {
		const handleClick = vi.fn();
		const container = document.createElement("div");

		render(html`<button @click=${handleClick}>Static</button>`, container);
		container.querySelector("button")!.click();

		expect(handleClick).toHaveBeenCalledOnce();
	});

	it("updates direct Signal substitutions in SVG parts", async () => {
		const radius = new Signal.State(4);
		const container = document.createElement("div");

		render(html`<svg>${svg`<circle cx="8" cy="8" r=${radius}></circle>`}</svg>`, container);

		const circle = container.querySelector("circle")!;

		expect(circle.getAttribute("r")).toBe("4");

		radius.set(6);
		await Promise.resolve();

		expect(circle.getAttribute("r")).toBe("6");
	});
});
