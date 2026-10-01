import { BaseElement } from "./BaseElement.js";

/** A base element with a directly reflected disabled state. */
export abstract class DisabledElement extends BaseElement {
	/** Whether the element is disabled directly. */
	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}
}
