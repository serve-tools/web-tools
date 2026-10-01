import { FormControlElement } from "./_form-control.js";

/** A form-associated custom element with the native validation facade. */
export class FormAssociatedElement extends FormControlElement {
	static readonly formAssociated = true;

	#customValidity = "";

	/** The associated form, if any. */
	get form(): HTMLFormElement | null {
		return this.internals.form;
	}

	/** Labels associated with this control in its tree. */
	get labels(): NodeList {
		return this.internals.labels;
	}

	/** The form-entry name. */
	get name(): string {
		return this.getAttribute("name") ?? "";
	}

	set name(value: string) {
		this.setAttribute("name", String(value));
	}

	/** The current constraint-validation state. */
	get validity(): ValidityState {
		return this.internals.validity;
	}

	/** The current constraint-validation message. */
	get validationMessage(): string {
		return this.internals.validationMessage;
	}

	/** Whether this control participates in constraint validation. */
	get willValidate(): boolean {
		return this.internals.willValidate;
	}

	/** The author-defined validation error, or an empty string when none is set. */
	protected get customValidity(): string {
		return this.#customValidity;
	}

	/** Runs constraint validation and dispatches `invalid` when invalid. */
	checkValidity(): boolean {
		return this.internals.checkValidity();
	}

	/** Runs interactive constraint validation. */
	reportValidity(): boolean {
		return this.internals.reportValidity();
	}

	/** Replaces the author-defined validation error. */
	setCustomValidity(message: string): void {
		this.#customValidity = String(message);

		this.synchronizeValidity();
	}

	/** Applies the current author-defined validation error to the platform internals. */
	protected synchronizeValidity(): void {
		if (this.#customValidity) {
			this.internals.setValidity({ customError: true }, this.#customValidity);
		} else {
			this.internals.setValidity({});
		}
	}
}
