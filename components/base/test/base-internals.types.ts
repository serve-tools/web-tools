import { BaseElement } from "@serve-tools/base-components/base";

class StatusElement extends BaseElement {
	set ready(value: boolean) {
		if (value) {
			this.internals.states.add("ready");
		} else {
			this.internals.states.delete("ready");
		}
	}

	set status(value: string) {
		this.internals.ariaLabel = value;
	}

	protected replaceInternals(internals: ElementInternals): void {
		// @ts-expect-error The base owns the stable internals reference.
		this.internals = internals;
	}
}

const element = new StatusElement();
element.ready = true;
element.status = "Ready";
// @ts-expect-error Internals are protected from application consumers.
element.internals;
// @ts-expect-error BaseElement does not introduce a form facade.
element.form;
