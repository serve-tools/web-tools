import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { CheckboxElement } from "../../src/checkbox-element.js";

const fixtures: Node[] = [];

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const defineCheckbox = (): { element: CheckboxElement; name: string } => {
	const name = `aui-checkbox-${crypto.randomUUID()}`;
	customElements.define(name, class extends CheckboxElement {});
	return { element: document.createElement(name) as CheckboxElement, name };
};

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

describe("CheckboxElement", () => {
	test("uses the host as the only focus, label, and form-control owner", async () => {
		const { element } = defineCheckbox();
		element.id = crypto.randomUUID();
		const label = document.createElement("label");
		label.htmlFor = element.id;
		label.textContent = "Receive updates";
		const fixture = append(document.createElement("div"));
		fixture.append(label, element);

		expect(element.tabIndex).toBe(0);
		expect(element.labels).toHaveLength(1);
		expect(element.labels.item(0)).toBe(label);
		expect(element.shadowRoot?.querySelectorAll("button, input, [role]")).toHaveLength(0);
		expect(
			element.shadowRoot?.querySelector('slot[name="indicator"]')?.parentElement?.getAttribute("aria-hidden"),
		).toBe("true");
		expect(element.shadowRoot?.querySelector("slot:not([name])")).not.toBeNull();

		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);
		await userEvent.click(label);
		expect(element.checked).toBe(true);
		expect(input).toHaveBeenCalledOnce();
		expect(change).toHaveBeenCalledOnce();
	});

	test("implements checked dirtiness, default checkedness, value, and native reset behavior", () => {
		const { element } = defineCheckbox();
		const form = append(document.createElement("form"));
		form.append(element);

		element.defaultChecked = true;
		expect(element.checked).toBe(true);
		expect(element.getAttribute("checked")).toBe("");
		element.checked = false;
		element.defaultChecked = false;
		element.defaultChecked = true;
		expect(element.checked).toBe(false);
		expect(element.defaultChecked).toBe(true);

		expect(element.value).toBe("on");
		element.value = "accepted";
		expect(element.getAttribute("value")).toBe("accepted");
		expect(element.value).toBe("accepted");

		element.indeterminate = true;
		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);
		form.reset();
		expect(element.checked).toBe(true);
		expect(element.indeterminate).toBe(true);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();

		element.defaultChecked = false;
		expect(element.checked).toBe(false);
	});

	test("submits one native-shaped value only while checked", () => {
		const { element } = defineCheckbox();
		const form = append(document.createElement("form"));
		element.name = "terms";
		form.append(element);

		expect([...new FormData(form)]).toEqual([]);
		element.checked = true;
		expect([...new FormData(form)]).toEqual([["terms", "on"]]);
		element.value = "yes";
		expect([...new FormData(form)]).toEqual([["terms", "yes"]]);
		element.name = "";
		expect([...new FormData(form)]).toEqual([]);
	});

	test("matches programmatic click, Space, and Enter activation essentials", async () => {
		const { element } = defineCheckbox();
		append(element);
		const events: string[] = [];
		for (const type of ["click", "input", "change"]) {
			element.addEventListener(type, () => events.push(type));
		}

		element.indeterminate = true;
		element.click();
		expect(element.checked).toBe(true);
		expect(element.indeterminate).toBe(false);
		expect(events).toEqual(["click", "input", "change"]);

		events.length = 0;
		element.focus();
		await userEvent.keyboard(" ");
		expect(element.checked).toBe(false);
		expect(events).toEqual(["click", "input", "change"]);

		events.length = 0;
		await userEvent.keyboard("{Enter}");
		expect(element.checked).toBe(false);
		expect(events).toEqual([]);
	});

	test("suppresses click activation while directly or fieldset disabled", () => {
		const { element } = defineCheckbox();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.append(element);
		const clicks = vi.fn();
		element.addEventListener("click", clicks);

		element.disabled = true;
		expect(element.tabIndex).toBe(-1);
		element.required = true;
		const native = document.createElement("input");
		native.type = "checkbox";
		native.required = true;
		native.disabled = true;
		expect(element.validity.valueMissing).toBe(native.validity.valueMissing);
		element.click();
		expect(element.checked).toBe(false);
		expect(clicks).not.toHaveBeenCalled();

		element.disabled = false;
		expect(element.tabIndex).toBe(0);
		fieldset.disabled = true;
		expect(element.willValidate).toBe(false);
		expect(element.tabIndex).toBe(-1);
		element.click();
		expect(element.checked).toBe(false);
		expect(clicks).not.toHaveBeenCalled();

		fieldset.disabled = false;
		expect(element.tabIndex).toBe(0);
		element.click();
		expect(element.checked).toBe(true);
		expect(clicks).toHaveBeenCalledOnce();
	});

	test("provides native constraint-validation methods and invalid events", () => {
		const { element } = defineCheckbox();
		append(element);
		element.required = true;
		const invalid = vi.fn((event: Event) => event.preventDefault());
		element.addEventListener("invalid", invalid);

		expect(element.validity.valueMissing).toBe(true);
		expect(element.checkValidity()).toBe(false);
		expect(invalid).toHaveBeenCalledOnce();
		element.checked = true;
		expect(element.checkValidity()).toBe(true);

		element.setCustomValidity("Choose explicitly");
		expect(element.validity.customError).toBe(true);
		expect(element.validationMessage).toBe("Choose explicitly");
		element.setCustomValidity("");
		expect(element.validity.valid).toBe(true);
	});

	test("restores all specified checkbox states without input or change events", () => {
		const { element } = defineCheckbox();
		append(element);
		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);

		for (const [state, checked, indeterminate] of [
			["checked", true, false],
			["unchecked", false, false],
			["checked/indeterminate", true, true],
			["unchecked/indeterminate", false, true],
		] as const) {
			element.formStateRestoreCallback(state, "restore");
			expect(element.checked).toBe(checked);
			expect(element.indeterminate).toBe(indeterminate);
		}

		element.formStateRestoreCallback("unknown", "restore");
		expect(element.checked).toBe(false);
		expect(element.indeterminate).toBe(true);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
	});

	test("upgrades properties assigned before custom-element definition", () => {
		const name = `aui-checkbox-${crypto.randomUUID()}`;
		const element = document.createElement(name) as CheckboxElement;
		element.defaultChecked = false;
		element.value = "before";
		element.name = "choice";
		element.required = true;
		element.checked = true;
		element.indeterminate = true;
		append(element);

		customElements.define(name, class extends CheckboxElement {});
		expect(element.checked).toBe(true);
		expect(element.defaultChecked).toBe(false);
		expect(element.indeterminate).toBe(true);
		expect(element.value).toBe("before");
		expect(element.name).toBe("choice");
		expect(element.required).toBe(true);
	});

	test("rolls back canceled .click() like native input", () => {
		const { element } = defineCheckbox();
		const input = document.createElement("input");
		input.type = "checkbox";
		const fixture = append(document.createElement("div"));
		fixture.append(element, input);
		fixture.addEventListener("click", (event) => event.preventDefault());

		const customInput = vi.fn();
		const nativeInput = vi.fn();
		element.addEventListener("input", customInput);
		input.addEventListener("input", nativeInput);
		element.click();
		input.click();
		expect(element.checked).toBe(input.checked);
		expect(element.checked).toBe(false);
		expect(customInput).not.toHaveBeenCalled();
		expect(nativeInput).not.toHaveBeenCalled();
	});

	test("documents the unavailable native default-action hook for later click cancellation", () => {
		const { element } = defineCheckbox();
		const input = document.createElement("input");
		input.type = "checkbox";
		const customParent = append(document.createElement("div"));
		const nativeParent = append(document.createElement("div"));
		customParent.append(element);
		nativeParent.append(input);
		customParent.addEventListener("click", (event) => event.preventDefault());
		nativeParent.addEventListener("click", (event) => event.preventDefault());
		const customInput = vi.fn();
		const nativeInput = vi.fn();
		element.addEventListener("input", customInput);
		input.addEventListener("input", nativeInput);

		element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(element.checked).toBe(true);
		expect(input.checked).toBe(false);
		expect(customInput).toHaveBeenCalledOnce();
		expect(nativeInput).not.toHaveBeenCalled();
	});
});
