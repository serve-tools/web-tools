import { afterEach, describe, expect, test } from "vitest";
import { CheckboxElement } from "../../src/CheckboxElement.js";
import { OptionElement } from "../../src/OptionElement.js";
import { SwitchElement } from "../../src/SwitchElement.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
});

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

describe("styling contract", () => {
	test("combines structural parts, host states, and authored slot selectors", () => {
		const checkboxName = `base-checkbox-${crypto.randomUUID()}`;
		const switchName = `base-switch-${crypto.randomUUID()}`;
		customElements.define(checkboxName, class extends CheckboxElement {});
		customElements.define(switchName, class extends SwitchElement {});

		const style = document.createElement("style");
		style.textContent = `
			${checkboxName}::part(control), ${switchName}::part(control) {
				border-block-start: 7px solid rgb(1, 2, 3);
			}
			${checkboxName}:state(checked)::part(control), ${switchName}:state(checked)::part(control) {
				background-color: rgb(4, 5, 6);
			}
			${checkboxName} > [slot="indicator"], ${switchName} > [slot="thumb"] {
				color: rgb(7, 8, 9);
			}
		`;
		append(style);

		const checkbox = document.createElement(checkboxName) as CheckboxElement;
		const indicator = document.createElement("span");
		indicator.slot = "indicator";
		checkbox.append(indicator);
		checkbox.checked = true;

		const toggle = document.createElement(switchName) as SwitchElement;
		const thumb = document.createElement("span");
		thumb.slot = "thumb";
		toggle.append(thumb);
		toggle.checked = true;
		append(checkbox);
		append(toggle);

		for (const control of [
			checkbox.shadowRoot?.querySelector<HTMLElement>("[part=control]"),
			toggle.shadowRoot?.querySelector<HTMLElement>("[part=control]"),
		]) {
			expect(control).toBeInstanceOf(HTMLElement);
			expect(getComputedStyle(control!).borderBlockStartWidth).toBe("7px");
			expect(getComputedStyle(control!).backgroundColor).toBe("rgb(4, 5, 6)");
		}
		expect(getComputedStyle(indicator).color).toBe("rgb(7, 8, 9)");
		expect(getComputedStyle(thumb).color).toBe("rgb(7, 8, 9)");
	});

	test("exposes option conditions as custom states while retaining data attributes", () => {
		const name = `base-option-${crypto.randomUUID()}`;
		customElements.define(name, class extends OptionElement {});
		const option = append(document.createElement(name) as OptionElement);
		option.value = "one";

		expect(option.matches(":state(active)")).toBe(false);
		expect(option.matches(":state(selected)")).toBe(false);
		expect(option.matches(":state(disabled)")).toBe(false);

		option.setListboxState(true, true);
		expect(option.matches(":state(active)")).toBe(true);
		expect(option.matches(":state(selected)")).toBe(true);
		expect(option.hasAttribute("selected")).toBe(false);
		expect(option.hasAttribute("data-active")).toBe(true);
		expect(option.hasAttribute("data-selected")).toBe(true);

		option.disabled = true;
		expect(option.matches(":state(disabled)")).toBe(true);
		expect(option.hasAttribute("data-disabled")).toBe(true);

		option.disabled = false;
		option.setListboxState(false, false, true);
		expect(option.matches(":state(active)")).toBe(false);
		expect(option.matches(":state(selected)")).toBe(false);
		expect(option.matches(":state(disabled)")).toBe(true);
		expect(option.hasAttribute("data-active")).toBe(false);
		expect(option.hasAttribute("data-selected")).toBe(false);
		expect(option.hasAttribute("data-disabled")).toBe(true);

		option.setListboxState(false, false, false);
		expect(option.matches(":state(disabled)")).toBe(false);
		expect(option.hasAttribute("data-disabled")).toBe(false);
	});
});
