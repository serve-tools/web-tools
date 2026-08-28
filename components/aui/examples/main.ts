import {
	AUIElement,
	CheckboxElement,
	DialogElement,
	TabsElement,
	ToggleElement,
	ToggleGroupElement,
} from "@serve-tools/aui";
import { Signal } from "@serve-tools/signal";
import { html, props, text } from "@serve-tools/signal-dom";

class CounterElement extends AUIElement {
	#count = new Signal.State(0);

	protected override layout(content: DocumentFragment): void {
		html(
			"button",
			props({ type: "button", onclick: () => this.#count.set(this.#count.get() + 1) }),
			text("Count: "),
			text(this.#count),
		)(content);
	}
}

customElements.define("app-checkbox", CheckboxElement);
customElements.define("app-tabs", TabsElement);
customElements.define("app-dialog", DialogElement);
customElements.define("app-counter", CounterElement);
customElements.define("app-toggle-group", ToggleGroupElement);
customElements.define("app-toggle", ToggleElement);

const form = document.querySelector<HTMLFormElement>("#preferences")!;
const checkbox = document.querySelector<CheckboxElement>("app-checkbox")!;
const lock = document.querySelector<HTMLInputElement>("#lock")!;
const submission = document.querySelector<HTMLOutputElement>("#submission")!;
const interaction = document.querySelector<HTMLOutputElement>("#interaction")!;
const dialog = document.querySelector<DialogElement>("app-dialog")!;
const dialogResult = document.querySelector<HTMLOutputElement>("#dialog-result")!;
const formatting = document.querySelector<ToggleGroupElement>("app-toggle-group")!;
const formattingResult = document.querySelector<HTMLOutputElement>("#formatting-result")!;

checkbox.addEventListener("beforechange", (event) => {
	if (lock.checked) {
		event.preventDefault();
		interaction.textContent = "The proposed change was canceled.";
	}
});
checkbox.addEventListener("change", () => {
	interaction.textContent = checkbox.checked ? "The checkbox is checked." : "The checkbox is unchecked.";
});
form.addEventListener("submit", (event) => {
	event.preventDefault();
	submission.textContent = `Submitted updates: ${new FormData(form).get("updates")}`;
});
form.addEventListener("reset", () => {
	interaction.textContent = "The checkbox was reset to its default.";
	submission.textContent = "No preferences submitted.";
});
document.querySelector("#open-dialog")!.addEventListener("click", () => dialog.showModal());
dialog.addEventListener("close", () => {
	dialogResult.textContent = `Dialog result: ${dialog.returnValue || "dismissed"}`;
});
formatting.addEventListener("change", () => {
	formattingResult.textContent = `Selected formatting: ${formatting.values.join(", ") || "none"}`;
});
