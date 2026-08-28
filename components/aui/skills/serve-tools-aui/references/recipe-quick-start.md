# Recipe: quick start

This public-import example is generated from the compile-checked `test/aui.recipes.ts` fixture in the package source.

```ts
import { Signal } from "@serve-tools/signal";
import { html, props, text } from "@serve-tools/signal-dom";
import { AUIElement, CheckboxElement } from "@serve-tools/aui";

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

customElements.define("app-checkbox", CheckboxElement);
const form = document.createElement("form");
const label = document.createElement("label");
const checkbox = document.createElement("app-checkbox") as CheckboxElement;
checkbox.name = "updates";
checkbox.value = "yes";
checkbox.uncheckedValue = "no";
label.append(checkbox, "Receive updates");
form.append(label);
document.body.append(form);

checkbox.addEventListener("beforechange", (event) => {
	if (form.dataset.locked === "true") {
		event.preventDefault();
	}
});
checkbox.click();
const submittedValue = new FormData(form).get("updates");
console.assert(submittedValue === "yes");
form.reset();
console.assert(!checkbox.checked);
```
