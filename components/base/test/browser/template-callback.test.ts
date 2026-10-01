import { Signal } from "@serve-tools/signal";
import { expect, test } from "vitest";
import { BaseElement } from "../../src/BaseElement.js";
import { html } from "../../src/template.js";

test("value callbacks track getter reads and resume without rebuilding Base layout", async () => {
	const state = new Signal.State("first");
	let layouts = 0;
	let reads = 0;
	class Example extends BaseElement {
		get value() {
			return state.get();
		}

		protected override layout() {
			++layouts;
			return html`<input .value=${() => this.value}><span title=${() => this.value}>${() => {
				++reads;
				return this.value;
			}}</span>`;
		}
	}
	const name = `template-callback-${crypto.randomUUID()}`;
	customElements.define(name, Example);
	const element = document.createElement(name) as Example;
	try {
		document.body.append(element);
		const input = element.querySelector("input")!;
		const span = element.querySelector("span")!;
		expect(span.textContent).toBe("first");
		expect(input.value).toBe("first");
		state.set("second");
		await new Promise<void>(queueMicrotask);
		expect(span.textContent).toBe("second");
		expect(span.title).toBe("second");
		expect(input.value).toBe("second");
		element.remove();
		const previousReads = reads;
		state.set("detached");
		await new Promise<void>(queueMicrotask);
		expect(reads).toBe(previousReads);
		expect(span.textContent).toBe("second");
		document.body.append(element);
		expect(span.textContent).toBe("detached");
		expect(element.querySelector("span")).toBe(span);
		expect(layouts).toBe(1);
	} finally {
		element.remove();
	}
});
