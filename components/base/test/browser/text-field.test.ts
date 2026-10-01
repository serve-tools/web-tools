import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { TextFieldElement } from "../../src/TextFieldElement.js";

const fixtures: HTMLElement[] = [];
function create(markup = "", attributes: Record<string, string> = {}) {
	const name = `text-field-${crypto.randomUUID()}`;
	customElements.define(name, class extends TextFieldElement {});
	const field = document.createElement(name) as TextFieldElement;
	for (const [key, value] of Object.entries(attributes)) {
		field.setAttribute(key, value);
	}
	field.innerHTML = markup;
	const form = document.createElement("form");
	form.append(field);
	document.body.append(form);
	fixtures.push(form);
	return { field, form };
}
afterEach(() => {
	for (const fixture of fixtures.splice(0)) {
		fixture.remove();
	}
});

describe("TextFieldElement", () => {
	test("owns native shadow labeling and exactly one form entry", () => {
		const { field, form } = create("", {
			label: "Email",
			description: "Recovery",
			name: "email",
			value: "person@example.com",
			type: "email",
		});
		expect(field.input!.getAttribute("type")).toBeNull();
		expect((field.input as HTMLInputElement).type).toBe("text");
		expect(field.shadowRoot!.querySelector("label")!.control).toBe(field.input);
		expect(field.input!.getAttribute("aria-describedby")).toBe("description");
		expect([...new FormData(form)]).toEqual([["email", "person@example.com"]]);
		expect(field.children.length).toBe(0);
		field.setAttribute("aria-label", "Recovery address");
		expect(field.input!.getAttribute("aria-label")).toBe("Recovery address");
	});

	test("password reveal preserves editor, focus, selection and multiline secrets", async () => {
		const { field, form } = create("", { type: "password", multiline: "", name: "secret" });
		field.value = "first line\nsecond line";
		const input = field.input!;
		expect(input.localName).toBe("textarea");
		field.focus();
		field.setSelectionRange(2, 8, "backward");
		expect(getComputedStyle(input).getPropertyValue("-webkit-text-security")).toBe("disc");
		field.revealed = true;
		expect(field.input).toBe(input);
		expect(getComputedStyle(input).getPropertyValue("-webkit-text-security")).toBe("none");
		expect(input.selectionDirection).toBe("backward");
		expect(field.shadowRoot!.activeElement).toBe(input);
		expect(field.selectionStart).toBe(2);
		expect(field.selectionEnd).toBe(8);
		expect([...new FormData(form)]).toEqual([["secret", "first line\nsecond line"]]);
		expect(field.hasAttribute("value")).toBe(false);
		field.revealed = false;
		expect(field.selectionEnd).toBe(8);
	});

	test("maps email intent to native validation without changing editor type", () => {
		const { field } = create("", { type: "email", required: "" });
		expect(field.validity.valueMissing).toBe(true);
		expect(field.errorVisible).toBe(false);
		field.value = "not an address";
		expect(field.validity.typeMismatch).toBe(true);
		expect(field.checkValidity()).toBe(false);
		expect(field.errorVisible).toBe(true);
		field.value = "person@example.com";
		expect(field.validity.valid).toBe(true);
		expect(field.errorVisible).toBe(false);
		field.setCustomValidity("Server rejection");
		expect(field.validationMessage).toBe("Server rejection");
		field.error = "Presentation only";
		expect(field.validationMessage).toBe("Server rejection");
		field.setCustomValidity("");
		expect(field.validity.valid).toBe(true);
		field.multiline = true;
		field.value = "person@\nexample.com";
		expect(field.validity.typeMismatch).toBe(true);
	});

	test("user events escape once, edits mark dirty and reset restores default", async () => {
		const { field, form } = create("", { value: "default", name: "text" });
		const events: string[] = [];
		field.addEventListener("input", () => events.push("input"));
		field.addEventListener("change", () => events.push("change"));
		await userEvent.fill(field.input!, "edited");
		field.input!.blur();
		expect(events.filter((event) => event === "input")).toHaveLength(1);
		expect(events.filter((event) => event === "change")).toHaveLength(1);
		expect(field.dirty).toBe(true);
		form.reset();
		expect(field.value).toBe("default");
		expect(field.dirty).toBe(false);
		field.remove();
		form.append(field);
		events.length = 0;
		await userEvent.fill(field.input!, "reconnected");
		field.input!.blur();
		expect(events).toEqual(["input", "change"]);
		field.resetState();
		field.value = "programmatic";
		expect(field.dirty).toBe(false);
		expect(field.defaultValue).toBe("default");
		field.formStateRestoreCallback("restored");
		expect(field.value).toBe("restored");
	});

	test("fieldset disabledness excludes submission and readonly bars validation", () => {
		const { field, form } = create("", { name: "text", required: "" });
		const fieldset = document.createElement("fieldset");
		form.append(fieldset);
		fieldset.append(field);
		fieldset.disabled = true;
		expect(field.input!.disabled).toBe(true);
		expect(field.willValidate).toBe(false);
		expect([...new FormData(form)]).toEqual([]);
		fieldset.disabled = false;
		field.setCustomValidity("Server error");
		field.disabled = true;
		expect(field.checkValidity()).toBe(true);
		field.disabled = false;
		field.readOnly = true;
		expect(field.input!.readOnly).toBe(true);
		expect(field.willValidate).toBe(false);
		expect(field.checkValidity()).toBe(true);
		field.readOnly = false;
		expect(field.validationMessage).toBe("Server error");
	});

	test("Enter activates the associated default submitter and respects cancellation", async () => {
		const { field, form } = create("", { name: "text" });
		form.id = `form-${crypto.randomUUID()}`;
		const button = document.createElement("button");
		button.setAttribute("form", form.id);
		button.name = "action";
		button.value = "save";
		form.before(button);
		fixtures.push(button);
		let clicks = 0;
		const submissions: (HTMLElement | null)[] = [];
		button.addEventListener("click", () => ++clicks);
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			submissions.push(event.submitter);
		});
		const enter = async (options: KeyboardEventInit = {}) => {
			field.input!.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					composed: true,
					cancelable: true,
					...options,
				}),
			);
			await new Promise<void>((resolve) => setTimeout(resolve));
		};
		await enter();
		expect(clicks).toBe(1);
		expect(submissions).toEqual([button]);
		expect(new FormData(form, button).get("action")).toBe("save");
		await enter({ isComposing: true });
		field.multiline = true;
		await enter();
		field.multiline = false;
		field.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
		await enter();
		button.disabled = true;
		await enter();
		expect(clicks).toBe(1);
		expect(submissions).toHaveLength(1);
	});

	test("trusted Enter waits for ancestor cancellation", async () => {
		const { field, form } = create();
		const button = document.createElement("button");
		form.append(button);
		let submissions = 0;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			++submissions;
		});
		field.focus();
		document.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
		await userEvent.keyboard("{Enter}");
		await new Promise<void>((resolve) => setTimeout(resolve));
		expect(submissions).toBe(0);
		await userEvent.keyboard("{Enter}");
		await new Promise<void>((resolve) => setTimeout(resolve));
		expect(submissions).toBe(1);
	});

	test("Enter without a submit button requires a single blocking field", async () => {
		const { field, form } = create();
		let submissions = 0;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			++submissions;
		});
		const enter = async () => {
			field.input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
			await new Promise<void>((resolve) => setTimeout(resolve));
		};
		await enter();
		expect(submissions).toBe(1);
		form.append(document.createElement("input"));
		await enter();
		expect(submissions).toBe(1);
	});

	test("rich content overrides fallback and accessory buttons stay outside label", async () => {
		const { field } = create(
			'<span slot="label">Rich <strong>label</strong></span><button slot="label-actions">Help</button>',
			{ label: "Fallback" },
		);
		const label = field.shadowRoot!.querySelector("label")!;
		const slot = label.querySelector("slot")!;
		expect(slot.assignedElements()[0]).toBe(field.children[0]);
		expect(label.contains(field.shadowRoot!.querySelector('[name="label-actions"]'))).toBe(false);
		await userEvent.click(field.children[0]);
		expect(field.shadowRoot!.activeElement).toBe(field.input);
		field.multiline = true;
		expect(field.input!.localName).toBe("textarea");
		expect(label.control).toBe(field.input);
	});
});
