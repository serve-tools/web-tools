import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { SwitchChangeDetail } from "../../src/SwitchElement.js";
import { SwitchElement } from "../../src/SwitchElement.js";

const fixtures: Node[] = [];
const microtask = () => new Promise<void>(queueMicrotask);

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const defineSwitch = (): SwitchElement => {
	const name = `base-switch-${crypto.randomUUID()}`;
	customElements.define(name, class extends SwitchElement {});
	return document.createElement(name) as SwitchElement;
};

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

describe("SwitchElement", () => {
	test("uses one labelable FACE host and exposes a decorative thumb without checkbox-only state", async () => {
		const element = defineSwitch();
		element.id = crypto.randomUUID();
		const label = document.createElement("label");
		label.htmlFor = element.id;
		label.textContent = "Notifications";
		append(document.createElement("div")).append(label, element);

		expect(element.tabIndex).toBe(0);
		expect(element.labels.item(0)).toBe(label);
		expect(element.shadowRoot?.querySelectorAll("button, input, [role]")).toHaveLength(0);
		expect(
			element.shadowRoot?.querySelector('slot[name="thumb"]')?.parentElement?.getAttribute("aria-hidden"),
		).toBe("true");
		expect("indeterminate" in element).toBe(false);

		await userEvent.click(label);
		expect(element.checked).toBe(true);
	});

	test("activates once through a wrapping label and decorative thumb", async () => {
		const element = defineSwitch();
		const label = append(document.createElement("label"));
		const thumb = document.createElement("span");
		thumb.slot = "thumb";
		thumb.textContent = "Thumb";
		element.append(thumb);
		label.append(element, " Notifications");
		const proposals = vi.fn();
		const input = vi.fn();
		element.addEventListener("beforechange", proposals);
		element.addEventListener("input", input);

		await userEvent.click(thumb);
		expect(element.checked).toBe(true);
		expect(proposals).toHaveBeenCalledOnce();
		expect(input).toHaveBeenCalledOnce();
	});

	test("implements checked dirtiness, reset, restore, and exact checked and unchecked form values", () => {
		const element = defineSwitch();
		const form = append(document.createElement("form"));
		element.name = "notifications";
		form.append(element);

		expect([...new FormData(form)]).toEqual([]);
		element.uncheckedValue = "off";
		expect([...new FormData(form)]).toEqual([["notifications", "off"]]);
		element.uncheckedValue = "";
		expect([...new FormData(form)]).toEqual([["notifications", ""]]);
		element.defaultChecked = true;
		expect(element.checked).toBe(true);
		expect([...new FormData(form)]).toEqual([["notifications", "on"]]);
		element.checked = false;
		element.defaultChecked = false;
		element.defaultChecked = true;
		expect(element.checked).toBe(false);
		form.reset();
		expect(element.checked).toBe(true);

		element.formStateRestoreCallback("unchecked", "restore");
		expect(element.checked).toBe(false);
		element.formStateRestoreCallback("checked", "restore");
		expect(element.checked).toBe(true);
		element.uncheckedValue = undefined;
		expect(element.hasAttribute("unchecked-value")).toBe(false);
	});

	test("uses the same cancelable transaction and one post-event pair for click, label, and Space", async () => {
		const element = defineSwitch();
		element.id = crypto.randomUUID();
		const label = document.createElement("label");
		label.htmlFor = element.id;
		label.textContent = "Switch";
		append(document.createElement("div")).append(label, element);
		const events: string[] = [];
		let detail: SwitchChangeDetail | undefined;
		element.addEventListener("beforechange", (event) => {
			detail = event.detail;
			events.push("beforechange");
		});
		for (const type of ["input", "change", "click"] as const) {
			element.addEventListener(type, () => events.push(type));
		}

		element.click();
		expect(events).toEqual(["beforechange", "input", "change", "click"]);
		expect(Object.isFrozen(detail)).toBe(true);
		element.checked = false;
		events.length = 0;
		await userEvent.click(label);
		expect(events).toEqual(["beforechange", "input", "change", "click"]);
		element.checked = false;
		events.length = 0;
		element.focus();
		await userEvent.keyboard(" ");
		expect(events).toEqual(["beforechange", "input", "change", "click"]);

		element.addEventListener("beforechange", (event) => event.preventDefault());
		element.click();
		expect(element.checked).toBe(true);
	});

	test("guards all proposal and post-event phases against reentrant activation", () => {
		const element = append(defineSwitch());
		const proposals = vi.fn();
		const changes = vi.fn();
		const clicks = vi.fn();
		element.addEventListener("click", clicks);
		element.addEventListener("beforechange", () => {
			proposals();
			element.click();
		});
		element.addEventListener("input", () => element.click());
		element.addEventListener("change", () => {
			changes();
			element.click();
		});

		element.click();
		expect(element.checked).toBe(true);
		expect(proposals).toHaveBeenCalledOnce();
		expect(changes).toHaveBeenCalledOnce();
		expect(clicks).toHaveBeenCalledOnce();
	});

	test("cancels beforechange across a shadow boundary and preserves input and change composition", () => {
		const element = defineSwitch();
		const fixture = append(document.createElement("div"));
		fixture.attachShadow({ mode: "open" }).append(element);
		let cancel = true;
		const outsideProposal = vi.fn((event: Event) => {
			if (cancel) {
				event.preventDefault();
			}
		});
		const outsideInput = vi.fn();
		const outsideChange = vi.fn();
		fixture.addEventListener("beforechange", outsideProposal);
		fixture.addEventListener("input", outsideInput);
		fixture.addEventListener("change", outsideChange);

		element.click();
		expect(element.checked).toBe(false);
		expect(outsideInput).not.toHaveBeenCalled();
		cancel = false;
		element.click();
		expect(element.checked).toBe(true);
		expect(outsideInput).toHaveBeenCalledOnce();
		expect(outsideChange).not.toHaveBeenCalled();
	});

	test("honors direct, fieldset, and read-only restrictions with native required validation", () => {
		const element = defineSwitch();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.append(element);
		element.required = true;
		expect(element.validity.valueMissing).toBe(true);
		element.readOnly = true;
		expect(element.willValidate).toBe(false);
		element.click();
		expect(element.checked).toBe(false);
		element.readOnly = false;
		fieldset.disabled = true;
		expect(element.tabIndex).toBe(-1);
		element.click();
		expect(element.checked).toBe(false);
		fieldset.disabled = false;
		element.click();
		expect(element.checked).toBe(true);
		expect(element.checkValidity()).toBe(true);
	});

	test("supports external form association and delayed Enter submission without toggling", async () => {
		const element = defineSwitch();
		const fixture = append(document.createElement("div"));
		const form = document.createElement("form");
		const submit = document.createElement("button");
		form.id = crypto.randomUUID();
		submit.type = "submit";
		element.setAttribute("form", form.id);
		form.append(submit);
		fixture.append(form, element);
		form.addEventListener("submit", (event) => event.preventDefault());
		const click = vi.fn();
		submit.addEventListener("click", click);

		element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		await microtask();
		expect(click).toHaveBeenCalledOnce();
		expect(element.checked).toBe(false);

		fixture.addEventListener("keydown", (event) => event.preventDefault());
		element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }));
		await microtask();
		expect(click).toHaveBeenCalledOnce();
	});

	test("recovers every public property assigned before definition", () => {
		const name = `base-switch-${crypto.randomUUID()}`;
		const element = document.createElement(name) as SwitchElement;
		element.defaultChecked = false;
		element.value = "yes";
		element.uncheckedValue = "no";
		element.name = "setting";
		element.disabled = true;
		element.readOnly = true;
		element.required = true;
		element.checked = true;
		append(element);

		customElements.define(name, class extends SwitchElement {});
		expect(element).toMatchObject({
			checked: true,
			defaultChecked: false,
			disabled: true,
			name: "setting",
			readOnly: true,
			required: true,
			uncheckedValue: "no",
			value: "yes",
		});
	});

	test("uses the owner document's event constructors after adoption", () => {
		const element = defineSwitch();
		const frame = append(document.createElement("iframe"));
		const foreignDocument = frame.contentDocument!;
		const ForeignEvent = foreignDocument.defaultView!.Event;
		const ForeignCustomEvent = foreignDocument.defaultView!.CustomEvent;
		foreignDocument.body.append(foreignDocument.adoptNode(element));
		fixtures.push(element);
		let proposal: Event | undefined;
		let input: Event | undefined;
		element.addEventListener("beforechange", (event) => (proposal = event));
		element.addEventListener("input", (event) => (input = event));

		element.click();
		expect(proposal).toBeInstanceOf(ForeignCustomEvent);
		expect(input).toBeInstanceOf(ForeignEvent);
	});
});
