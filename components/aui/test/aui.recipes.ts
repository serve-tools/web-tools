import { scopedHtml, html as template } from "@serve-tools/aui/template";
import { Signal } from "@serve-tools/signal";
import { AUIElement, CheckboxElement } from "../src/aui.js";

class CounterElement extends AUIElement {
	#count = new Signal.State(0);

	protected layout(content: DocumentFragment): void {
		content.append(scopedHtml(this)`
			<button type="button" @click=${() => this.#count.set(this.#count.get() + 1)}>${this.#count}</button>
		`);
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

// Opt-in persistent templates do not use AUIElement's disconnect/suspend lifecycle.
const owner = { count: new Signal.State(0) };
const view = template(owner)`<button @click=${() => owner.count.set(owner.count.get() + 1)}>${owner.count}</button>`;
const button = view.querySelector("button")!;
document.body.append(view);
button.remove();
document.body.append(button); // Moving the existing DOM preserves its bindings.
view.dispose(); // Retire the view explicitly; this does not remove its DOM.
