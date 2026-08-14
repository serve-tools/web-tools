import { Signal } from "@serve-tools/signal";
import { LitElement } from "lit";
import { describe, expect, it } from "vitest";

import { html, SignalElement } from "../src/lit-signals.js";

class SignalElementTestElement extends SignalElement {
	readonly count = new Signal.State(1);
	renders = 0;

	protected override render() {
		++this.renders;

		return html`${this.count.get()}`;
	}
}

customElements.define("serve-tools-signal-element-test", SignalElementTestElement);

describe("SignalElement", () => {
	it("precomposes LitElement with complete Signal tracking", async () => {
		const element = new SignalElementTestElement();

		document.body.append(element);
		await element.updateComplete;

		try {
			expect(element).toBeInstanceOf(LitElement);
			expect(element.shadowRoot?.textContent).toBe("1");
			expect(element.renders).toBe(1);

			element.count.set(2);
			await element.updateComplete;

			expect(element.shadowRoot?.textContent).toBe("2");
			expect(element.renders).toBe(2);
		} finally {
			element.remove();
		}
	});
});
