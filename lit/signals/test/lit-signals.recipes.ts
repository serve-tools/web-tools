import { LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { html, Signal, watch } from "../src/lit-signals.js";

@customElement("recipe-counter")
class RecipeCounter extends LitElement {
	readonly count = new Signal.State(0);

	protected render() {
		return html`<button @click=${() => this.count.set(this.count.get() + 1)}>Count: ${watch(this.count)}</button>`;
	}
}

void RecipeCounter;
