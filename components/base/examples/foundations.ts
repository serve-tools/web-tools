import { BaseElement } from "@serve-tools/base-components/base";
import { FormAssociatedElement } from "@serve-tools/base-components/form-associated";

/** Demonstrates the shared, lazily attached internals used for default ARIA and custom CSS states. */
export class GalleryStatusElement extends BaseElement {
	#active = false;
	#button: HTMLButtonElement | undefined;
	#status: HTMLOutputElement | undefined;

	protected override layout(content: DocumentFragment): void {
		this.internals.role = "group";
		this.internals.ariaLabel = "Activity status";

		this.#button = this.ownerDocument.createElement("button");
		this.#button.type = "button";
		this.#button.addEventListener("click", () => {
			this.#active = !this.#active;
			this.#synchronize();
		});

		this.#status = this.ownerDocument.createElement("output");
		this.#status.setAttribute("aria-live", "polite");

		content.append(this.#button, " ", this.#status);
		this.#synchronize();
	}

	#synchronize(): void {
		if (this.#active) {
			this.internals.states.add("active");
		} else {
			this.internals.states.delete("active");
		}

		this.#button!.ariaPressed = String(this.#active);
		this.#button!.textContent = this.#active ? "Deactivate" : "Activate";
		this.#status!.textContent = this.#active ? "Active" : "Inactive";
	}
}

/** Demonstrates a custom control whose host owns its form value through FormAssociatedElement. */
export class GalleryFormControlElement extends FormAssociatedElement {
	#button: HTMLButtonElement | undefined;
	#formDisabled = false;
	#value: "high" | "normal" = "normal";

	protected override layout(content: DocumentFragment): void {
		this.#button = this.ownerDocument.createElement("button");
		this.#button.type = "button";
		this.#button.addEventListener("click", () => {
			this.#value = this.#value === "normal" ? "high" : "normal";
			this.#synchronize();
			this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
			this.dispatchEvent(new Event("change", { bubbles: true }));
		});

		content.append(this.#button);
		this.#synchronize();
	}

	formDisabledCallback(disabled: boolean): void {
		this.#formDisabled = disabled;
		if (this.#button) {
			this.#button.disabled = disabled;
		}
	}

	formResetCallback(): void {
		this.#value = "normal";
		this.#synchronize();
	}

	#synchronize(): void {
		this.internals.setFormValue(this.#value);
		if (this.#button) {
			this.#button.disabled = this.#formDisabled;
			this.#button.textContent = `Priority: ${this.#value}`;
		}
	}
}

/** Shows the submitted value without navigating away from the gallery. */
export function initializeFoundationExamples(): void {
	const form = document.querySelector<HTMLFormElement>("#foundation-form")!;
	const result = document.querySelector<HTMLOutputElement>("#foundation-form-result")!;

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const entries = Array.from(new FormData(form, event.submitter), ([name, value]) => `${name}: ${value}`);
		result.textContent = entries.length ? `Submitted ${entries.join(", ")}.` : "No value submitted.";
	});
	form.addEventListener("reset", () => {
		result.textContent = "No priority submitted.";
	});
}
