import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { AutocompleteElement } from "../../src/autocomplete-element.js";
import { ComboboxElement } from "../../src/combobox-element.js";
import { FieldElement } from "../../src/field-element.js";
import { OptionElement } from "../../src/option-element.js";
import { SelectElement } from "../../src/select-element.js";

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

const define = () => {
	const option = `aui-option-${crypto.randomUUID()}`;
	const autocomplete = `aui-autocomplete-${crypto.randomUUID()}`;
	const combobox = `aui-combobox-${crypto.randomUUID()}`;
	const select = `aui-select-${crypto.randomUUID()}`;
	customElements.define(option, class extends OptionElement {});
	customElements.define(autocomplete, class extends AutocompleteElement {});
	customElements.define(combobox, class extends ComboboxElement {});
	customElements.define(select, class extends SelectElement {});
	return { autocomplete, combobox, option, select };
};

const option = (name: string, value: string, label = value): OptionElement => {
	const element = document.createElement(name) as OptionElement;
	element.value = value;
	element.textContent = label;
	return element;
};

describe("selection elements", () => {
	test("keeps native input form and label identity for autocomplete without duplicate query events", async () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.name = "airport";
		input.id = crypto.randomUUID();
		const label = document.createElement("label");
		label.htmlFor = input.id;
		label.textContent = "Airport";
		const popup = document.createElement("div");
		popup.popover = "manual";
		popup.append(option(names.option, "jfk", "JFK"));
		host.append(input, popup);
		append(host);
		append(label);
		await userEvent.click(label);
		expect(document.activeElement).toBe(input);
		const inputEvents = vi.fn();
		input.addEventListener("input", inputEvents);
		input.value = "J";
		input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
		expect(inputEvents).toHaveBeenCalledOnce();
	});

	test("uses frozen DOM-order values, explicit empty values, cancellation, and listener-write recovery", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.name = "service";
		host.multiple = true;
		const input = document.createElement("input");
		const popup = document.createElement("div");
		popup.popover = "manual";
		const empty = option(names.option, "", "None");
		const pro = option(names.option, "pro", "Professional");
		popup.append(empty, pro);
		host.append(input, popup);
		append(host);
		host.values = [""];
		expect(host.values).toEqual([""]);
		expect(host.value).toBe("");
		const changes = vi.fn();
		host.addEventListener("change", changes);
		host.addEventListener("beforechange", (event) => event.preventDefault(), { once: true });
		pro.click();
		expect(host.values).toEqual([""]);
		expect(changes).not.toHaveBeenCalled();
		host.addEventListener("beforechange", () => (host.values = ["pro"]), { once: true });
		empty.click();
		expect(host.values).toEqual(["pro"]);
	});

	test("submits one FACE identity, resets markup defaults, validates against the native control, and ignores nested collections", () => {
		const names = define();
		const form = document.createElement("form");
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.name = "service";
		host.required = true;
		const input = document.createElement("input");
		const popup = document.createElement("div");
		popup.popover = "manual";
		const pro = option(names.option, "pro");
		pro.defaultSelected = true;
		const nested = document.createElement(names.combobox) as ComboboxElement;
		const nestedInput = document.createElement("input");
		const nestedPopup = document.createElement("div");
		nestedPopup.popover = "manual";
		nestedPopup.append(option(names.option, "nested"));
		nested.append(nestedInput, nestedPopup);
		popup.append(pro, nested);
		host.append(input, popup);
		form.append(host);
		append(form);
		expect(host.values).toEqual(["pro"]);
		expect([...new FormData(form)]).toEqual([["service", "pro"]]);
		expect(host.validity.valid).toBe(true);
		host.values = [];
		expect(host.validity.valueMissing).toBe(true);
		expect(host.validationMessage).toBeTruthy();
		form.reset();
		expect(host.values).toEqual(["pro"]);
	});

	test("moves active descendants from textbox and button controls without taking DOM focus", async () => {
		const names = define();
		for (const kind of [names.combobox, names.select]) {
			const host = document.createElement(kind) as ComboboxElement | SelectElement;
			const control = document.createElement(kind === names.select ? "button" : "input");
			const popup = document.createElement("div");
			popup.popover = "manual";
			const first = option(names.option, "one");
			const second = option(names.option, "two");
			popup.append(first, second);
			host.append(control, popup);
			append(host);
			(control as HTMLElement).focus();
			await userEvent.keyboard("{ArrowDown}");
			expect(document.activeElement).toBe(control);
			expect(control.getAttribute("aria-activedescendant")).toBe(first.id);
		}
	});

	test("accepts a keyboard-highlighted selection once, closes its native popup, and serializes repeated values in DOM order", async () => {
		const names = define();
		const form = append(document.createElement("form"));
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.name = "service";
		host.multiple = true;
		const input = document.createElement("input");
		const popup = document.createElement("div");
		popup.popover = "manual";
		const basic = option(names.option, "basic");
		const pro = option(names.option, "pro");
		popup.append(basic, pro);
		host.append(input, popup);
		form.append(host);
		input.focus();
		const events: string[] = [];
		host.addEventListener("beforechange", () => events.push("beforechange"));
		host.addEventListener("input", () => events.push("input"));
		host.addEventListener("change", () => events.push("change"));
		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(host.values).toEqual(["basic"]);
		expect(popup.matches(":popover-open")).toBe(false);
		expect(events).toEqual(["beforechange", "input", "change"]);
		host.values = ["pro", "basic"];
		expect(host.values).toEqual(["basic", "pro"]);
		expect([...new FormData(form)]).toEqual([
			["service", "basic"],
			["service", "pro"],
		]);
	});

	test("filters after composition and text mutation while keeping query edits distinct from acceptance", async () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.name = "city";
		const popup = document.createElement("div");
		popup.popover = "manual";
		const paris = option(names.option, "paris", "Paris");
		const rome = option(names.option, "rome", "Rome");
		popup.append(paris, rome);
		host.append(input, popup);
		append(host);
		input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
		input.value = "par";
		input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertCompositionText" }));
		expect(rome.hasAttribute("data-filtered")).toBe(false);
		input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
		expect(paris.hasAttribute("data-filtered")).toBe(false);
		expect(rome.hasAttribute("data-filtered")).toBe(true);
		rome.firstChild!.textContent = "Parma";
		await new Promise<void>(queueMicrotask);
		expect(rome.hasAttribute("data-filtered")).toBe(false);
		const events: string[] = [];
		input.addEventListener("input", () => events.push("input"));
		input.addEventListener("change", () => events.push("change"));
		paris.click();
		expect(input.value).toBe("Paris");
		expect(events).toEqual(["input", "change"]);
	});

	test("initializes Autocomplete filtering from the current input and resynchronizes after reset and replacement", async () => {
		const names = define();
		const form = append(document.createElement("form"));
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.defaultValue = "par";
		const popup = document.createElement("div");
		popup.popover = "manual";
		const paris = option(names.option, "paris", "Paris");
		const rome = option(names.option, "rome", "Rome");
		popup.append(paris, rome);
		host.append(input, popup);
		form.append(host);
		input.focus();
		await userEvent.keyboard("{ArrowDown}");
		expect(paris.hidden).toBe(false);
		expect(rome.hidden).toBe(true);

		input.value = "rom";
		input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
		expect(paris.hidden).toBe(true);
		expect(rome.hidden).toBe(false);
		form.reset();
		await new Promise<void>(queueMicrotask);
		expect(input.value).toBe("par");
		expect(paris.hidden).toBe(false);
		expect(rome.hidden).toBe(true);

		const replacement = document.createElement("input");
		replacement.value = "rom";
		input.replaceWith(replacement);
		await new Promise<void>(queueMicrotask);
		expect(paris.hidden).toBe(true);
		expect(rome.hidden).toBe(false);
	});

	test("blocks Autocomplete acceptance for disabled or readonly native inputs and listener changes", () => {
		const names = define();
		const host = document.createElement(names.autocomplete) as AutocompleteElement;
		const input = document.createElement("input");
		input.value = "Par";
		const popup = document.createElement("div");
		popup.popover = "manual";
		const paris = option(names.option, "paris", "Paris");
		popup.append(paris);
		host.append(input, popup);
		append(host);
		const events: string[] = [];
		host.addEventListener("beforechange", () => events.push("beforechange"));
		input.addEventListener("input", () => events.push("input"));
		input.addEventListener("change", () => events.push("change"));

		input.disabled = true;
		paris.click();
		input.disabled = false;
		input.readOnly = true;
		paris.click();
		expect(input.value).toBe("Par");
		expect(events).toEqual([]);

		input.readOnly = false;
		host.addEventListener("beforechange", () => (input.readOnly = true), { once: true });
		paris.click();
		expect(input.value).toBe("Par");
		expect(events).toEqual(["beforechange"]);
	});

	test("synchronously reconciles reflected option identity and defaults with FACE form state", () => {
		const names = define();
		const form = append(document.createElement("form"));
		const host = document.createElement(names.combobox) as ComboboxElement;
		host.name = "service";
		const input = document.createElement("input");
		const popup = document.createElement("div");
		popup.popover = "manual";
		const selected = option(names.option, "one");
		selected.defaultSelected = true;
		popup.append(selected);
		host.append(input, popup);
		form.append(host);
		expect([...new FormData(form)]).toEqual([["service", "one"]]);

		selected.value = "two";
		expect(host.values).toEqual(["two"]);
		expect([...new FormData(form)]).toEqual([["service", "two"]]);
		host.values = [];
		selected.defaultSelected = false;
		selected.defaultSelected = true;
		expect(selected.selected).toBe(false);
		expect([...new FormData(form)]).toEqual([]);
		form.reset();
		expect(host.values).toEqual(["two"]);
	});

	test("participates as a Field control and preserves custom validity over required-state changes and reset", () => {
		const names = define();
		const fieldName = `aui-field-${crypto.randomUUID()}`;
		customElements.define(fieldName, class extends FieldElement {});
		const form = append(document.createElement("form"));
		const field = document.createElement(fieldName) as FieldElement;
		const host = document.createElement(names.select) as SelectElement;
		host.slot = "control";
		host.name = "service";
		host.required = true;
		const button = document.createElement("button");
		const popup = document.createElement("div");
		popup.popover = "manual";
		popup.append(option(names.option, "pro"));
		host.append(button, popup);
		field.append(host);
		form.append(field);

		expect(field.control).toBe(host);
		expect(host.validity.valueMissing).toBe(true);
		expect(field.invalid).toBe(true);
		host.setCustomValidity("Server rejected this selection");
		field.refresh();
		expect(host.validity.customError).toBe(true);
		expect(host.validity.valueMissing).toBe(true);
		expect(host.validationMessage).toBe("Server rejected this selection");
		host.values = ["pro"];
		expect(host.validity.customError).toBe(true);
		expect(host.validity.valueMissing).toBe(false);
		expect(host.validationMessage).toBe("Server rejected this selection");

		host.setCustomValidity("");
		field.refresh();
		expect(host.validity.valid).toBe(true);
		host.values = [];
		expect(host.validity.valueMissing).toBe(true);
		expect(host.validationMessage).toBe("Please select an option.");
		host.setCustomValidity("Still invalid");
		form.reset();
		expect(host.validity.customError).toBe(true);
		expect(host.validationMessage).toBe("Still invalid");
	});

	test("tracks dynamic FACE labels, forwards host naming, and restores direct control naming", async () => {
		const names = define();
		const host = document.createElement(names.select) as SelectElement;
		host.id = crypto.randomUUID();
		host.setAttribute("aria-label", "Host name");
		host.setAttribute("aria-labelledby", "host-description");
		const button = document.createElement("button");
		button.setAttribute("aria-labelledby", "button-description");
		const popup = document.createElement("div");
		popup.popover = "manual";
		popup.append(option(names.option, "one"));
		host.append(button, popup);
		append(host);
		expect(button.getAttribute("aria-label")).toBe("Host name");
		expect(button.getAttribute("aria-labelledby")?.split(/\s+/)).toEqual([
			"button-description",
			"host-description",
		]);

		const label = document.createElement("label");
		label.htmlFor = host.id;
		label.textContent = "Selection";
		append(label);
		host.refresh();
		expect(label.id).toBeTruthy();
		expect(button.getAttribute("aria-labelledby")?.split(/\s+/)).toContain(label.id);

		label.htmlFor = "elsewhere";
		host.refresh();
		expect(button.getAttribute("aria-labelledby")?.split(/\s+/)).toEqual([
			"button-description",
			"host-description",
		]);
		host.remove();
		expect(button.getAttribute("aria-label")).toBeNull();
		expect(button.getAttribute("aria-labelledby")).toBe("button-description");
	});

	test("regenerates owned listbox and option IDs when adoption introduces collisions", async () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const popup = document.createElement("div");
		popup.popover = "manual";
		const first = option(names.option, "one");
		popup.append(first);
		host.append(input, popup);
		append(host);
		const oldPopupId = popup.id;
		const oldOptionId = first.id;

		const frame = append(document.createElement("iframe"));
		const target = frame.contentDocument!;
		const popupCollision = target.createElement("div");
		popupCollision.id = oldPopupId;
		const optionCollision = target.createElement("div");
		optionCollision.id = oldOptionId;
		target.body.append(popupCollision, optionCollision);
		target.body.append(target.adoptNode(host));
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		expect(popup.id).not.toBe(oldPopupId);
		expect(first.id).not.toBe(oldOptionId);
		expect(input.getAttribute("aria-controls")).toBe(popup.id);
		expect(target.getElementById(popup.id)).toBe(popup);
		expect(target.getElementById(first.id)).toBe(first);
	});

	test("respects readonly, disabled fieldsets, external form association, option replacement, and Escape dismissal", async () => {
		const names = define();
		const form = append(document.createElement("form"));
		form.id = crypto.randomUUID();
		const fieldset = document.createElement("fieldset");
		const host = document.createElement(names.select) as SelectElement;
		host.name = "region";
		host.setAttribute("form", form.id);
		const button = document.createElement("button");
		const popup = document.createElement("div");
		popup.popover = "manual";
		const first = option(names.option, "one");
		popup.append(first);
		host.append(button, popup);
		fieldset.append(host);
		append(fieldset);
		first.click();
		expect(host.values).toEqual(["one"]);
		expect([...new FormData(form)]).toEqual([["region", "one"]]);
		host.readOnly = true;
		first.click();
		expect(host.values).toEqual(["one"]);
		host.readOnly = false;
		fieldset.disabled = true;
		first.click();
		expect(host.values).toEqual(["one"]);
		fieldset.disabled = false;
		const replacement = option(names.option, "two");
		first.replaceWith(replacement);
		await new Promise<void>(queueMicrotask);
		expect(host.values).toEqual([]);
		button.focus();
		await userEvent.keyboard("{ArrowDown}");
		expect(popup.matches(":popover-open")).toBe(true);
		await userEvent.keyboard("{Escape}");
		expect(popup.matches(":popover-open")).toBe(false);
		await userEvent.keyboard("{ArrowDown}");
		await userEvent.click(document.body);
		expect(popup.matches(":popover-open")).toBe(false);
	});

	test("rejects missing and duplicate owned option values before it can expose a selection", () => {
		const names = define();
		const host = document.createElement(names.combobox) as ComboboxElement;
		const input = document.createElement("input");
		const popup = document.createElement("div");
		popup.popover = "manual";
		const missing = document.createElement(names.option) as OptionElement;
		popup.append(missing);
		host.append(input, popup);
		expect(() => host.values).toThrow(/explicit value/);
		missing.value = "one";
		popup.append(option(names.option, "one"));
		expect(() => host.values).toThrow(/unique/);
	});

	test("restores an owned popup attribute after detach and recovers values assigned before custom-element upgrade", async () => {
		const optionName = `aui-option-${crypto.randomUUID()}`;
		const hostName = `aui-combobox-${crypto.randomUUID()}`;
		customElements.define(optionName, class extends OptionElement {});
		const fixture = document.createElement("div");
		fixture.innerHTML = `<${hostName}><input><div popover="manual"><${optionName} value="pro">Professional</${optionName}></div></${hostName}>`;
		const host = fixture.firstElementChild as ComboboxElement;
		host.values = ["pro"];
		customElements.define(hostName, class extends ComboboxElement {});
		await customElements.whenDefined(hostName);
		append(fixture);
		const popup = host.querySelector("[popover]")!;
		expect(host.values).toEqual(["pro"]);
		expect(popup.getAttribute("popover")).toBe("auto");
		fixture.remove();
		expect(popup.getAttribute("popover")).toBe("manual");
	});
});
