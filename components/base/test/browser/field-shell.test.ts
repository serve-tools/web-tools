import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ComboboxElement } from "../../src/ComboboxElement.js";
import { FieldElement } from "../../src/FieldElement.js";
import { SelectElement } from "../../src/SelectElement.js";

const fixtures: Node[] = [];
const mutation = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const defineField = (): FieldElement => {
	const name = `base-field-shell-${crypto.randomUUID()}`;
	customElements.define(name, class extends FieldElement {});
	return document.createElement(name) as FieldElement;
};

const append = <NodeType extends Node>(node: NodeType): NodeType => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

describe("FieldElement shell", () => {
	test("provides stable unstyled regions and omits empty groups", () => {
		const field = defineField();
		const input = document.createElement("input");
		const before = document.createElement("button");
		const after = document.createElement("button");
		const labelActions = document.createElement("button");
		input.slot = "control";
		before.slot = "before";
		after.slot = "after";
		labelActions.slot = "label-actions";
		field.label = "Account email";
		field.description = "Used for account recovery.";
		field.append(before, input, after, labelActions);
		append(field);

		const root = field.shadowRoot!;
		expect(root.querySelector("[part='content']")).not.toBeNull();
		expect([...root.querySelectorAll("slot")].map((slot) => slot.name)).toEqual([
			"label",
			"label-actions",
			"before",
			"control",
			"after",
			"description",
			"error",
		]);
		expect(root.querySelector<HTMLElement>("[part='label-content']")!.hidden).toBe(false);
		expect(root.querySelector<HTMLElement>("[part='control-content']")!.hidden).toBe(false);
		expect(root.querySelector<HTMLElement>("[part='description-content']")!.hidden).toBe(false);
		expect(root.querySelector<HTMLElement>("[part='error-content']")!.hidden).toBe(true);
		expect(field.labelElement?.textContent).toBe("Account email");
		expect(field.descriptions[0]?.textContent).toBe("Used for account recovery.");
	});

	test("uses stable light-DOM text fallbacks without shadowing authored slots", async () => {
		const host = append(document.createElement("div"));
		const root = host.attachShadow({ mode: "open" });
		const field = defineField();
		const input = document.createElement("input");
		input.required = true;
		input.slot = "control";
		field.label = "Generated label";
		field.description = "Generated description";
		field.error = "Generated error";
		field.showError = true;
		field.append(input);
		root.append(field);

		const fallbackLabel = field.labelElement!;
		const fallbackDescription = field.descriptions[0];
		const fallbackError = field.errors[0];
		expect(fallbackLabel.parentElement).toBe(field);
		expect(fallbackLabel.getRootNode()).toBe(root);
		expect(fallbackLabel.control).toBe(input);
		expect(input.getAttribute("aria-describedby")).toBe(fallbackDescription.id);
		expect(input.getAttribute("aria-errormessage")).toBe(fallbackError.id);

		const label = document.createElement("label");
		const description = document.createElement("p");
		const error = document.createElement("p");
		label.slot = "label";
		description.slot = "description";
		error.slot = "error";
		field.append(label, description, error);
		await mutation();

		expect(field.labelElement).toBe(label);
		expect(field.descriptions).toEqual([description]);
		expect(field.errors).toEqual([error]);
		expect(fallbackLabel.parentNode).toBeNull();
		expect(fallbackDescription.parentNode).toBeNull();
		expect(fallbackError.parentNode).toBeNull();

		label.remove();
		description.remove();
		error.remove();
		await mutation();

		expect(field.labelElement).toBe(fallbackLabel);
		expect(field.descriptions).toEqual([fallbackDescription]);
		expect(field.errors).toEqual([fallbackError]);
		expect(fallbackLabel.control).toBe(input);
	});

	test("updates retained fallbacks while disconnected and reconciles authored precedence", () => {
		const field = defineField();
		const input = document.createElement("input");
		input.slot = "control";
		field.label = "First label";
		field.append(input);
		append(field);
		const fallback = field.labelElement!;

		field.remove();
		field.label = "Second label";
		expect(field.labelElement).toBe(fallback);
		expect(fallback.textContent).toBe("Second label");
		const authored = document.createElement("label");
		authored.slot = "label";
		field.append(authored);
		expect(field.labelElement).toBe(authored);
		expect(fallback.parentNode).toBeNull();

		document.body.append(field);
		expect(field.labelElement).toBe(authored);
		expect(authored.control).toBe(input);
	});

	test("reveals native errors after validation or touch without changing control validity", async () => {
		const field = defineField();
		const input = document.createElement("input");
		const outside = append(document.createElement("button"));
		input.required = true;
		input.slot = "control";
		input.setAttribute("aria-errormessage", "author-error");
		field.error = "Enter an email address.";
		field.append(input);
		append(field);

		const nativeMessage = input.validationMessage;
		const error = field.errors[0];
		const errorContent = field.shadowRoot!.querySelector<HTMLElement>("[part='error-content']")!;
		expect(nativeMessage).not.toBe("");
		expect(input.validity.valueMissing).toBe(true);
		expect(input.validity.customError).toBe(false);
		expect(error.textContent).toBe("Enter an email address.");
		expect(field.errorVisible).toBe(false);
		expect(field.matches(":state(error-visible)")).toBe(false);
		expect(errorContent.hidden).toBe(true);
		expect(input.getAttribute("aria-errormessage")).toBe("author-error");

		let invalidDefaultPrevented: boolean | undefined;
		input.addEventListener("invalid", (event) => (invalidDefaultPrevented = event.defaultPrevented), {
			once: true,
		});
		expect(input.checkValidity()).toBe(false);
		expect(invalidDefaultPrevented).toBe(false);
		expect(field.errorVisible).toBe(true);
		expect(field.matches(":state(error-visible)")).toBe(true);
		expect(errorContent.hidden).toBe(false);
		expect(input.getAttribute("aria-errormessage")?.split(/\s+/u)).toEqual(["author-error", error.id]);
		expect(input.validationMessage).toBe(nativeMessage);
		expect(input.validity.customError).toBe(false);

		field.resetState();
		expect(field.errorVisible).toBe(false);
		expect(input.getAttribute("aria-errormessage")).toBe("author-error");
		field.showError = true;
		expect(field.errorVisible).toBe(true);

		input.value = "person@example.com";
		field.refresh();
		expect(field.errorVisible).toBe(false);
		expect(errorContent.hidden).toBe(true);
		expect(input.getAttribute("aria-errormessage")).toBe("author-error");

		field.showError = false;
		input.value = "";
		field.refresh();
		input.focus();
		outside.focus();
		await mutation();
		expect(field.touched).toBe(true);
		expect(field.errorVisible).toBe(true);
	});

	test("uses the native validation message when no error text or slot is authored", () => {
		const field = defineField();
		const input = document.createElement("input");
		input.required = true;
		input.slot = "control";
		field.showError = true;
		field.append(input);
		append(field);

		expect(field.errors).toHaveLength(1);
		expect(field.errors[0].textContent).toBe(input.validationMessage);
		expect(field.errorVisible).toBe(true);
		expect(input.getAttribute("aria-errormessage")).toBe(field.errors[0].id);
	});

	test("replays text and visibility properties assigned before upgrade", () => {
		const name = `late-field-shell-${crypto.randomUUID()}`;
		const field = document.createElement(name);
		const input = document.createElement("input");
		input.required = true;
		input.slot = "control";
		Reflect.set(field, "label", "Late label");
		Reflect.set(field, "description", "Late description");
		Reflect.set(field, "error", "Late error");
		Reflect.set(field, "showError", true);
		field.append(input);
		append(field);

		customElements.define(name, class extends FieldElement {});
		const upgraded = field as FieldElement;
		expect(upgraded.label).toBe("Late label");
		expect(upgraded.description).toBe("Late description");
		expect(upgraded.error).toBe("Late error");
		expect(upgraded.showError).toBe(true);
		expect(upgraded.labelElement?.textContent).toBe("Late label");
		expect(upgraded.descriptions[0]?.textContent).toBe("Late description");
		expect(upgraded.errors[0]?.textContent).toBe("Late error");
		expect(upgraded.errorVisible).toBe(true);
		for (const property of ["description", "error", "label", "showError"] as const) {
			expect(Object.hasOwn(upgraded, property)).toBe(false);
		}
	});

	test("hands generated and replaced label associations to FACE controls with internal focus surfaces", async () => {
		for (const [Constructor, editorName] of [
			[SelectElement, "button"],
			[ComboboxElement, "input"],
		] as const) {
			const name = `field-shell-control-${crypto.randomUUID()}`;
			customElements.define(name, class extends Constructor {});
			const field = defineField();
			const control = document.createElement(name) as SelectElement | ComboboxElement;
			const editor = document.createElement(editorName);
			const popup = document.createElement("div");
			popup.popover = "manual";
			control.slot = "control";
			control.setAttribute("aria-labelledby", "author-name");
			control.append(editor, popup);
			field.label = "Generated label";
			field.append(control);
			append(field);

			const fallback = field.labelElement!;
			await mutation();
			expect(fallback.control).toBe(control);
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u)).toContain("author-name");
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u)).toContain(fallback.id);
			control.setAttribute("aria-labelledby", "next-author-name");
			await mutation();
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u)).toContain("next-author-name");
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u)).toContain(fallback.id);
			await userEvent.click(fallback);
			expect(document.activeElement).toBe(editor);

			const authored = document.createElement("label");
			authored.slot = "label";
			authored.textContent = "Authored label";
			field.append(authored);
			await mutation();
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u)).toContain(authored.id);
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u)).not.toContain(fallback.id);
			await userEvent.click(authored);
			expect(document.activeElement).toBe(editor);

			const firstAuthoredId = authored.id;
			authored.id = `authored-label-${crypto.randomUUID()}`;
			await mutation();
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u)).toContain(authored.id);
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u)).not.toContain(firstAuthoredId);

			const ambiguous = document.createElement("input");
			ambiguous.slot = "control";
			field.append(ambiguous);
			await mutation();
			expect(field.control).toBeNull();
			expect(editor.getAttribute("aria-labelledby")?.split(/\s+/u) ?? []).not.toContain(authored.id);
		}
	});

	test("keeps label actions and control accessories independently interactive", async () => {
		const field = defineField();
		const input = document.createElement("input");
		const before = document.createElement("button");
		const after = document.createElement("button");
		const action = document.createElement("button");
		const beforeClick = vi.fn();
		const afterClick = vi.fn();
		const actionClick = vi.fn();
		input.slot = "control";
		before.slot = "before";
		after.slot = "after";
		action.slot = "label-actions";
		before.addEventListener("click", beforeClick);
		after.addEventListener("click", afterClick);
		action.addEventListener("click", actionClick);
		field.label = "Search";
		field.append(before, input, after, action);
		append(field);

		await userEvent.click(before);
		await userEvent.click(after);
		await userEvent.click(action);
		expect(beforeClick).toHaveBeenCalledOnce();
		expect(afterClick).toHaveBeenCalledOnce();
		expect(actionClick).toHaveBeenCalledOnce();
		expect(field.control).toBe(input);

		await userEvent.click(field.labelElement!);
		expect(document.activeElement).toBe(input);
	});
});
