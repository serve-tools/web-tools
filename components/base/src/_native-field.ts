import { FormControlElement } from "./_form-control.js";
import type { AttributeOwner } from "./_ownership.js";

/** Shared native form facade for wrappers that retain one authored input as the only control. */
export abstract class NativeFieldElement extends FormControlElement {
	/** The retained native input, which owns focus, validation, and form submission. */
	abstract get input(): HTMLInputElement | null;

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
