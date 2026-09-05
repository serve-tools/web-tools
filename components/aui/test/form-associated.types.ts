import type { FormAssociatedElement as BarrelFormAssociatedElement } from "@serve-tools/aui";
import type { AUIElement } from "@serve-tools/aui/base";
import { FormAssociatedElement } from "@serve-tools/aui/form-associated";
import { html } from "@serve-tools/aui/template";

class ExampleControl extends FormAssociatedElement {
	set value(value: string) {
		this.internals.setFormValue(value);
	}

	protected override layout() {
		return html`<slot></slot>`;
	}

	protected override synchronizeValidity(): void {
		super.synchronizeValidity();
	}
}

const control = new ExampleControl();
const base: AUIElement = control;
const barrel: BarrelFormAssociatedElement = control;
const form: HTMLFormElement | null = control.form;
const validity: ValidityState = control.validity;
const labels: NodeList = control.labels;
const valid: boolean = control.checkValidity();
control.setCustomValidity("");
control.name = "answer";
control.disabled = false;
control.readOnly = true;
control.required = true;

// @ts-expect-error Internals belong to the subclass, not its consumers.
control.internals;
// @ts-expect-error Form association follows the platform and is not assignable.
control.form = document.createElement("form");

void [base, barrel, form, validity, labels, valid];
