import { DisabledElement } from "./_disabled.js";

/** Common reflected attributes for custom form controls and retained native-input wrappers. */
export class FormControlElement extends DisabledElement {
	/** Whether the control is read-only. */
	get readOnly(): boolean {
		return this.hasAttribute("readonly");
	}

	set readOnly(value: boolean) {
		this.toggleAttribute("readonly", Boolean(value));
	}

	/** Whether the control requires a value for constraint validation. */
	get required(): boolean {
		return this.hasAttribute("required");
	}

	set required(value: boolean) {
		this.toggleAttribute("required", Boolean(value));
	}
}
