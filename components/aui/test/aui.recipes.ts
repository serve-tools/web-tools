import { Signal } from "@serve-tools/signal";
import { html, props, text } from "@serve-tools/signal-dom";
import { AUIElement } from "../src/aui.js";

class CounterElement extends AUIElement {
	#count = new Signal.State(0);

	protected layout(content: DocumentFragment): void {
		html(
			"button",
			props({
				type: "button",
				onclick: () => this.#count.set(this.#count.get() + 1),
			}),
			text(this.#count),
		)(content);
	}
}

customElements.define("app-counter", CounterElement);
const counter = document.createElement("app-counter");
document.body.append(counter);
counter.remove();
document.body.append(counter);
