import type { AttributeOwner } from "./.ownership.js";
import { AUIElement } from "./aui-element.js";

/** Shared native form facade for wrappers that retain one authored input as the only control. */
export abstract class NativeFieldElement extends AUIElement {
	/** The retained native input, which owns focus, validation, and form submission. */
	abstract get input(): HTMLInputElement | null;

	get disabled(): boolean {
		return this.hasAttribute("disabled");
	}

	set disabled(value: boolean) {
		this.toggleAttribute("disabled", Boolean(value));
	}

	get readOnly(): boolean {
		return this.hasAttribute("readonly");
	}

	set readOnly(value: boolean) {
		this.toggleAttribute("readonly", Boolean(value));
	}

	get required(): boolean {
		return this.hasAttribute("required");
	}

	set required(value: boolean) {
		this.toggleAttribute("required", Boolean(value));
	}

	get validity(): ValidityState | null {
		return this.input?.validity ?? null;
	}

	get validationMessage(): string {
		return this.input?.validationMessage ?? "";
	}

	checkValidity(): boolean {
		return this.input?.checkValidity() ?? true;
	}

	reportValidity(): boolean {
		return this.input?.reportValidity() ?? true;
	}

	protected override createLayoutRoot(): ShadowRoot {
		return this.attachShadow({ mode: "open" });
	}
}

/** Applies the common boolean conveniences without introducing a subclass hook. */
export const synchronizeNativeFieldAttributes = (
	host: NativeFieldElement,
	input: HTMLInputElement | undefined,
	owned: AttributeOwner,
): void => {
	if (!input) {
		return;
	}

	for (const name of ["disabled", "readonly", "required"] as const) {
		if (host.hasAttribute(name)) {
			owned.own(input, name, "");
		} else {
			owned.releaseAttribute(input, name);
		}
	}
};

/** Updates one native-field host custom state. */
export const setNativeFieldState = (internals: ElementInternals, state: string, present: boolean): void => {
	if (present) {
		internals.states.add(state);
	} else {
		internals.states.delete(state);
	}
};
