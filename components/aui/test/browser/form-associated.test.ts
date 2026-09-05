import { afterEach, describe, expect, test } from "vitest";
import { CheckboxElement } from "../../src/checkbox-element.js";
import { ComboboxElement } from "../../src/combobox-element.js";
import { FormAssociatedElement } from "../../src/form-associated-element.js";
import { SelectElement } from "../../src/select-element.js";
import { SwitchElement } from "../../src/switch-element.js";

const fixtures: HTMLElement[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0)) {
		fixture.remove();
	}
});

class ExampleControl extends FormAssociatedElement {
	validityUpdates = 0;
	restored: string | File | FormData | null = null;
	resets = 0;

	get controlInternals(): ElementInternals {
		return this.internals;
	}

	submit(value: string | File | FormData | null, state?: string | File | FormData | null): void {
		this.internals.setFormValue(value, state);
	}

	formResetCallback(): void {
		++this.resets;
		this.submit("default");
	}

	formStateRestoreCallback(state: string | File | FormData | null): void {
		this.restored = state;
		this.submit(state);
	}

	protected override synchronizeValidity(): void {
		++this.validityUpdates;
		super.synchronizeValidity();
	}
}

const createControl = (): ExampleControl => {
	const name = `aui-form-foundation-${crypto.randomUUID()}`;
	customElements.define(name, class extends ExampleControl {});
	return document.createElement(name) as ExampleControl;
};

const attach = (...children: HTMLElement[]): HTMLFormElement => {
	const form = document.createElement("form");
	form.append(...children);
	document.body.append(form);
	fixtures.push(form);
	return form;
};

describe("FormAssociatedElement", () => {
	test("supports leaf-owned late-upgrade recovery after private state initializes", () => {
		const name = `aui-late-form-foundation-${crypto.randomUUID()}`;
		const unresolved = document.createElement(name);
		Object.assign(unresolved, { name: "answer", disabled: true, readOnly: true, required: true });
		attach(unresolved);

		class LateControl extends FormAssociatedElement {
			#ready = true;

			constructor() {
				super();
				const properties = this as unknown as Record<string, unknown>;
				for (const property of ["name", "disabled", "readOnly", "required"]) {
					if (!Object.hasOwn(this, property)) {
						continue;
					}
					const value = properties[property];
					delete properties[property];
					properties[property] = value;
				}
			}

			override get disabled(): boolean {
				return super.disabled;
			}

			override set disabled(value: boolean) {
				expect(this.#ready).toBe(true);
				super.disabled = value;
			}
		}

		customElements.define(name, LateControl);
		expect(unresolved).toBeInstanceOf(LateControl);
		for (const property of ["name", "disabled", "readOnly", "required"]) {
			expect(Object.hasOwn(unresolved, property)).toBe(false);
		}
		expect(unresolved.getAttribute("name")).toBe("answer");
		for (const attribute of ["disabled", "readonly", "required"]) {
			expect(unresolved.hasAttribute(attribute)).toBe(true);
		}
	});

	test.each([CheckboxElement, SwitchElement, SelectElement, ComboboxElement])(
		"does not call a consumer validity hook from a control constructor",
		(Base) => {
			class ConsumerControl extends Base {
				#ready = true;
				updates = 0;

				protected override get customValidity(): string {
					expect(this.#ready).toBe(true);
					return super.customValidity;
				}

				protected override synchronizeValidity(): void {
					expect(this.#ready).toBe(true);
					++this.updates;
					super.synchronizeValidity();
				}
			}

			const name = `aui-consumer-foundation-${crypto.randomUUID()}`;
			customElements.define(name, ConsumerControl);
			const control = new ConsumerControl();
			expect(control.updates).toBe(0);
			control.setCustomValidity("Custom failure");
			expect(control.updates).toBe(1);
			expect(control.validationMessage).toBe("Custom failure");
		},
	);

	test("reflects shared attributes without choosing a value or required-validation policy", () => {
		const control = createControl();
		control.name = "answer";
		control.disabled = true;
		control.readOnly = true;
		control.required = true;
		expect(control.getAttribute("name")).toBe("answer");
		expect(control.hasAttribute("disabled")).toBe(true);
		expect(control.hasAttribute("readonly")).toBe(true);
		expect(control.hasAttribute("required")).toBe(true);
		control.removeAttribute("readonly");
		expect(control.readOnly).toBe(false);
		control.disabled = false;
		expect(control.hasAttribute("disabled")).toBe(false);
		expect(control.validity.valid).toBe(true);
		expect(control.validityUpdates).toBe(0);
	});

	test("initializes internals without invoking subclass hooks before subclass state exists", () => {
		const control = createControl();
		expect(control.validityUpdates).toBe(0);
		expect(control.controlInternals).toBe(control.controlInternals);
		expect(control.form).toBeNull();
		expect(control.validity.valid).toBe(true);
	});

	test("shares the native form, label and validity facade without another form control", () => {
		const control = createControl();
		control.id = crypto.randomUUID();
		control.setAttribute("name", "answer");
		const label = document.createElement("label");
		label.htmlFor = control.id;
		label.textContent = "Answer";
		const form = attach(label, control);
		control.submit("yes");
		expect(control.form).toBe(form);
		expect([...control.labels]).toEqual([label]);
		expect([...form.elements]).toEqual([control]);
		expect([...new FormData(form)]).toEqual([["answer", "yes"]]);
		expect(control.validity).toBe(control.controlInternals.validity);
		expect(control.willValidate).toBe(control.controlInternals.willValidate);

		const invalidEvents: Event[] = [];
		control.addEventListener("invalid", (event) => {
			invalidEvents.push(event);
			event.preventDefault();
		});
		control.setCustomValidity("Please check this answer.");
		expect(control.validityUpdates).toBe(1);
		expect(control.validationMessage).toBe("Please check this answer.");
		expect(control.validity.customError).toBe(true);
		expect(control.checkValidity()).toBe(false);
		expect(control.reportValidity()).toBe(false);
		expect(invalidEvents).toHaveLength(2);
		control.setCustomValidity("");
		expect(control.validationMessage).toBe("");
		expect(control.checkValidity()).toBe(true);
	});

	test("leaves submission shape and reset or restoration policy to the control", () => {
		const control = createControl();
		control.setAttribute("name", "answer");
		const form = attach(control);
		const values = new FormData();
		values.append("choice", "a");
		values.append("choice", "b");
		control.submit(values, "a,b");
		expect([...new FormData(form)]).toEqual([
			["choice", "a"],
			["choice", "b"],
		]);
		control.submit(null);
		expect([...new FormData(form)]).toEqual([]);
		form.reset();
		expect(control.resets).toBe(1);
		expect([...new FormData(form)]).toEqual([["answer", "default"]]);
		control.formStateRestoreCallback("restored");
		expect(control.restored).toBe("restored");
		expect([...new FormData(form)]).toEqual([["answer", "restored"]]);
	});
});
