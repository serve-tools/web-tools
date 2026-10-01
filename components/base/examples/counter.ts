import { BaseElement } from "@serve-tools/base-components/base";
import { html } from "@serve-tools/base-components/template";
import { Signal } from "@serve-tools/signal";

export class CounterElement extends BaseElement {
	#count = new Signal.State(0);

	protected override layout() {
		return html`<button type="button" @click=${this.increment}>Count: ${this.#count}</button>`;
	}

	increment(): void {
		this.#count.set(this.#count.get() + 1);
	}
}
