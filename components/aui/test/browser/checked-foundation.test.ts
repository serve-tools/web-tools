import { afterEach, describe, expect, test, vi } from "vitest";
import { CheckboxElement } from "../../src/checkbox-element.js";
import { CheckboxGroupElement } from "../../src/checkbox-group-element.js";
import { FormAssociatedElement } from "../../src/form-associated-element.js";
import { SwitchElement } from "../../src/switch-element.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

const definitions = [
	["checkbox", CheckboxElement],
	["switch", SwitchElement],
] as const;

describe("checked-control foundation", () => {
	test("refreshes Checkbox validation when group disabledness changes behind direct disabledness", () => {
		const checkboxName = `aui-checked-foundation-${crypto.randomUUID()}`;
		const groupName = `aui-checked-foundation-group-${crypto.randomUUID()}`;
		customElements.define(checkboxName, class extends CheckboxElement {});
		customElements.define(groupName, class extends CheckboxGroupElement {});
		const checkbox = document.createElement(checkboxName) as CheckboxElement;
		const group = append(document.createElement(groupName)) as CheckboxGroupElement;
		checkbox.value = "choice";
		checkbox.disabled = true;
		group.append(checkbox);

		group.disabled = true;
		checkbox.setCustomValidity("Choose explicitly");
		expect(checkbox.validity.valid).toBe(true);

		group.disabled = false;
		checkbox.setCustomValidity("Choose explicitly");
		expect(checkbox.validity.customError).toBe(true);

		group.disabled = true;
		checkbox.setCustomValidity("Choose explicitly");
		expect(checkbox.validity.valid).toBe(true);
	});

	test("does not dispatch initialization through a consumer override", () => {
		class ConsumerCheckbox extends CheckboxElement {
			#ready = false;

			constructor() {
				super();
				this.#ready = true;
			}

			protected override initializeCheckedControl(): void {
				if (!this.#ready) {
					throw new Error("Checkbox consumer is not initialized");
				}
			}
		}

		class ConsumerSwitch extends SwitchElement {
			#ready = false;

			constructor() {
				super();
				this.#ready = true;
			}

			protected override initializeCheckedControl(): void {
				if (!this.#ready) {
					throw new Error("Switch consumer is not initialized");
				}
			}
		}

		for (const Base of [ConsumerCheckbox, ConsumerSwitch]) {
			const name = `aui-checked-foundation-${crypto.randomUUID()}`;
			customElements.define(name, Base);
			const element = append(document.createElement(name)) as CheckboxElement | SwitchElement;
			expect(element.checked).toBe(false);
		}
	});

	test.each(definitions)("preserves the %s public contract through the shared form-associated base", (_, Base) => {
		const name = `aui-checked-foundation-${crypto.randomUUID()}`;
		customElements.define(name, class extends Base {});
		const element = document.createElement(name) as CheckboxElement | SwitchElement;
		const form = append(document.createElement("form"));
		element.name = "setting";
		element.required = true;
		form.append(element);

		expect(element).toBeInstanceOf(FormAssociatedElement);
		expect(element.validity.valueMissing).toBe(true);

		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);
		element.addEventListener("beforechange", (event) => event.preventDefault(), { once: true });
		element.click();
		expect(element.checked).toBe(false);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();

		element.click();
		expect(element.checked).toBe(true);
		expect(element.validity.valid).toBe(true);
		expect([...new FormData(form)]).toEqual([["setting", "on"]]);
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
	});

	test.each(definitions)("recovers %s properties only after concrete state is initialized", (_, Base) => {
		const name = `aui-checked-foundation-${crypto.randomUUID()}`;
		const element = document.createElement(name) as CheckboxElement | SwitchElement;
		element.defaultChecked = false;
		element.value = "yes";
		element.uncheckedValue = "no";
		element.name = "setting";
		element.disabled = true;
		element.readOnly = true;
		element.required = true;
		element.checked = true;
		element.tabIndex = 3;
		append(element);

		customElements.define(name, class extends Base {});
		expect(element).toMatchObject({
			checked: true,
			defaultChecked: false,
			disabled: true,
			name: "setting",
			readOnly: true,
			required: true,
			tabIndex: -1,
			uncheckedValue: "no",
			value: "yes",
		});

		element.disabled = false;
		expect(element.tabIndex).toBe(3);
		element.defaultChecked = true;
		expect(element.checked).toBe(true);
	});
});
