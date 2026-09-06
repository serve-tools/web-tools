import { afterEach, describe, expect, test, vi } from "vitest";
import { CheckboxElement } from "../../src/CheckboxElement.js";
import { FieldElement } from "../../src/FieldElement.js";
import { NumberFieldElement } from "../../src/NumberFieldElement.js";
import { OTPFieldElement } from "../../src/OTPFieldElement.js";

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

const append = <T extends Node>(node: T): T => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

const defineField = (): FieldElement => {
	const name = `base-field-${crypto.randomUUID()}`;
	customElements.define(name, class extends FieldElement {});
	return document.createElement(name) as FieldElement;
};

const create = (control: HTMLElement = document.createElement("input")) => {
	const element = defineField();
	const label = document.createElement("label");
	const description = document.createElement("p");
	const error = document.createElement("p");
	label.slot = "label";
	control.slot = "control";
	description.slot = "description";
	error.slot = "error";
	element.append(label, control, description, error);
	append(element);
	return { control, description, element, error, label };
};

describe("FieldElement", () => {
	test("coordinates one authored control without creating another form identity", () => {
		const form = append(document.createElement("form"));
		const input = document.createElement("input");
		input.name = "email";
		input.value = "person@example.com";
		const { description, element, error, label } = create(input);
		element.remove();
		form.append(element);

		expect(element.control).toBe(input);
		expect(element.label).toBe(label);
		expect(element.descriptions).toEqual([description]);
		expect(element.errors).toEqual([error]);
		expect(Object.isFrozen(element.descriptions)).toBe(true);
		expect(Object.isFrozen(element.errors)).toBe(true);
		expect(label.htmlFor).toBe(input.id);
		expect(input.getAttribute("aria-describedby")).toBe(description.id);
		expect(input.getAttribute("aria-errormessage")).toBe(error.id);
		expect([...form.elements]).toEqual([input]);
		expect([...new FormData(form)]).toEqual([["email", "person@example.com"]]);

		const slots = [...element.shadowRoot!.querySelectorAll("slot")];
		expect(slots.map((slot) => slot.name)).toEqual(["label", "control", "description", "error"]);
		expect(slots.map((slot) => slot.getAttribute("part"))).toEqual(["label", "control", "description", "error"]);
	});

	test("surfaces native validity and presentation state without dispatching form events", async () => {
		const input = document.createElement("input");
		input.required = true;
		const { element } = create(input);
		const inputEvent = vi.fn();
		const changeEvent = vi.fn();
		element.addEventListener("input", inputEvent);
		element.addEventListener("change", changeEvent);

		expect(element.valid).toBe(false);
		expect(element.invalid).toBe(true);
		expect(element.required).toBe(true);
		expect(element.filled).toBe(false);
		expect(element.dirty).toBe(false);
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(element.matches(":state(invalid)")).toBe(true);
		expect(element.matches(":state(required)")).toBe(true);

		input.value = "person@example.com";
		element.refresh();
		expect(element.valid).toBe(true);
		expect(element.invalid).toBe(false);
		expect(element.filled).toBe(true);
		expect(element.dirty).toBe(true);
		expect(input.hasAttribute("aria-invalid")).toBe(false);

		input.setCustomValidity("Server rejected this address");
		element.refresh();
		expect(element.invalid).toBe(true);
		expect(input.validationMessage).toBe("Server rejected this address");
		expect(input.validity.customError).toBe(true);
		input.setCustomValidity("");
		element.refresh();
		expect(element.valid).toBe(true);

		element.resetState();
		expect(element.dirty).toBe(false);
		expect(inputEvent).not.toHaveBeenCalled();
		expect(changeEvent).not.toHaveBeenCalled();
		await mutation();
		expect(inputEvent).not.toHaveBeenCalled();
		expect(changeEvent).not.toHaveBeenCalled();
	});

	test("tracks user value, focus, touched, and checked state against a resettable baseline", async () => {
		const input = document.createElement("input");
		const { element } = create(input);
		const outside = append(document.createElement("button"));

		input.focus();
		expect(element.focused).toBe(true);
		expect(element.matches(":state(focused)")).toBe(true);
		input.value = "changed";
		input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
		expect(element.dirty).toBe(true);
		expect(element.filled).toBe(true);

		outside.focus();
		await mutation();
		expect(element.focused).toBe(false);
		expect(element.touched).toBe(true);
		expect(element.matches(":state(touched)")).toBe(true);

		element.resetState();
		expect(element.dirty).toBe(false);
		expect(element.touched).toBe(false);
		input.value = "";
		element.refresh();
		expect(element.dirty).toBe(true);
		expect(element.filled).toBe(false);

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		const checkedField = create(checkbox).element;
		expect(checkedField.filled).toBe(false);
		checkbox.checked = true;
		checkedField.refresh();
		expect(checkedField.filled).toBe(true);
		expect(checkedField.dirty).toBe(true);
	});

	test("resets tracking only after an uncanceled reset from the control's live external form", async () => {
		const first = append(document.createElement("form"));
		const second = append(document.createElement("form"));
		first.id = crypto.randomUUID();
		second.id = crypto.randomUUID();
		const input = document.createElement("input");
		input.name = "query";
		input.defaultValue = "initial";
		input.setAttribute("form", first.id);
		const { element } = create(input);

		input.value = "changed";
		element.refresh();
		expect(element.dirty).toBe(true);
		const cancel = (event: Event) => event.preventDefault();
		first.addEventListener("reset", cancel, { once: true });
		first.reset();
		await mutation();
		expect(input.value).toBe("changed");
		expect(element.dirty).toBe(true);

		input.setAttribute("form", second.id);
		await mutation();
		first.reset();
		await mutation();
		expect(element.dirty).toBe(true);

		second.reset();
		await mutation();
		expect(input.value).toBe("initial");
		expect(element.dirty).toBe(false);
		expect(element.touched).toBe(false);
	});

	test("invalidates deferred reset tracking when the connection ends", async () => {
		const form = append(document.createElement("form"));
		const input = document.createElement("input");
		input.defaultValue = "initial";
		const { element } = create(input);
		element.remove();
		form.append(element);
		input.value = "changed";
		input.defaultValue = "next";
		element.refresh();
		expect(element.dirty).toBe(true);

		form.reset();
		element.remove();
		await mutation();
		expect(input.value).toBe("next");
		expect(element.dirty).toBe(true);

		document.body.append(element);
		expect(element.dirty).toBe(true);
	});

	test("observes noncomposed form resets from its current shadow root", async () => {
		const host = append(document.createElement("div"));
		const root = host.attachShadow({ mode: "open" });
		const form = document.createElement("form");
		const input = document.createElement("input");
		input.defaultValue = "initial";
		const { element } = create(input);
		element.remove();
		form.append(element);
		root.append(form);
		const resetState = vi.spyOn(element, "resetState");
		expect(input.form).toBe(form);

		input.value = "changed";
		input.defaultValue = "next";
		element.refresh();
		expect(element.dirty).toBe(true);
		form.reset();
		await mutation();

		expect(input.value).toBe("next");
		expect(resetState).toHaveBeenCalledOnce();
		expect(element.dirty).toBe(false);
		expect(element.touched).toBe(false);
	});

	test("preserves author IDREF tokens and restores only owned relationships", async () => {
		const input = document.createElement("input");
		input.setAttribute("aria-describedby", "author-description");
		input.setAttribute("aria-errormessage", "author-error");
		const { description, element, error, label } = create(input);
		label.htmlFor = "author-control";
		element.refresh();
		const descriptionId = description.id;
		const errorId = error.id;

		expect(input.getAttribute("aria-describedby")?.split(/\s+/u)).toEqual(["author-description", descriptionId]);
		expect(input.getAttribute("aria-errormessage")?.split(/\s+/u)).toEqual(["author-error", errorId]);

		input.setAttribute("aria-describedby", `new-author ${descriptionId}`);
		input.setAttribute("aria-errormessage", `new-error ${errorId}`);
		await mutation();
		input.remove();
		await mutation();

		expect(input.getAttribute("aria-describedby")).toBe("new-author");
		expect(input.getAttribute("aria-errormessage")).toBe("new-error");
		expect(input.hasAttribute("id")).toBe(false);
		expect(label.htmlFor).toBe("author-control");
		expect(description.hasAttribute("id")).toBe(false);
		expect(error.hasAttribute("id")).toBe(false);
	});

	test("fails closed for zero or multiple usable controls and recovers after mutation", async () => {
		const first = document.createElement("input");
		const field = create(first);
		const second = document.createElement("input");
		second.slot = "control";
		field.element.append(second);
		await mutation();

		expect(field.element.control).toBeNull();
		expect(first.hasAttribute("id")).toBe(false);
		expect(field.label.hasAttribute("for")).toBe(false);
		expect(field.description.hasAttribute("id")).toBe(false);

		second.remove();
		await mutation();
		expect(field.element.control).toBe(first);
		expect(field.label.htmlFor).toBe(first.id);

		first.slot = "description";
		await mutation();
		expect(field.element.control).toBeNull();
		expect(field.element.valid).toBeNull();
		expect(field.element.invalid).toBe(false);
	});

	test("commits a replacement only after its value and state can be read", () => {
		const field = create();
		const original = field.control as HTMLInputElement;
		const originalId = original.id;
		const replacement = document.createElement("input");
		replacement.slot = "control";
		Object.defineProperty(replacement, "value", {
			configurable: true,
			get() {
				throw new Error("unavailable value");
			},
		});
		original.replaceWith(replacement);

		expect(() => field.element.refresh()).toThrowError("unavailable value");
		expect(original.id).toBe(originalId);
		expect(field.label.htmlFor).toBe(originalId);
		expect(replacement.hasAttribute("id")).toBe(false);

		Reflect.deleteProperty(replacement, "value");
		field.element.refresh();
		expect(field.element.control).toBe(replacement);
		expect(original.hasAttribute("id")).toBe(false);
		expect(field.label.htmlFor).toBe(replacement.id);
		replacement.value = "changed";
		field.element.refresh();
		expect(field.element.dirty).toBe(true);
	});

	test("allocates and reuses generated IDs only while unique in the current shadow root", () => {
		const host = append(document.createElement("div"));
		const root = host.attachShadow({ mode: "open" });
		const name = `base-field-${crypto.randomUUID()}`;
		customElements.define(name, class extends FieldElement {});
		const makeField = () => {
			const element = document.createElement(name) as FieldElement;
			const label = document.createElement("label");
			const input = document.createElement("input");
			label.slot = "label";
			input.slot = "control";
			element.append(label, input);
			return { element, input, label };
		};

		const first = makeField();
		root.append(first.element);
		const suffix = Number(first.input.id.slice(first.input.id.lastIndexOf("-") + 1));
		const predictedId = `${name}-control-${suffix + 1}`;
		const existing = document.createElement("input");
		existing.id = predictedId;
		root.append(existing);

		const second = makeField();
		root.append(second.element);
		expect(second.input.id).not.toBe(predictedId);
		expect(root.getElementById(predictedId)).toBe(existing);
		expect(second.label.control).toBe(second.input);

		const firstOwnedId = first.input.id;
		first.element.remove();
		const laterOwner = document.createElement("div");
		laterOwner.id = firstOwnedId;
		root.append(laterOwner, first.element);
		expect(first.input.id).not.toBe(firstOwnedId);
		expect(root.getElementById(firstOwnedId)).toBe(laterOwner);
		expect(first.label.control).toBe(first.input);
	});

	test("restores relationships while disconnected and reuses them on reconnect", () => {
		const { description, element, error, label } = create();
		const control = element.control!;
		const ids = [control.id, description.id, error.id];

		element.remove();
		expect(element.control).toBe(control);
		expect(control.hasAttribute("id")).toBe(false);
		expect(description.hasAttribute("id")).toBe(false);
		expect(error.hasAttribute("id")).toBe(false);
		expect(label.hasAttribute("for")).toBe(false);

		document.body.append(element);
		expect([control.id, description.id, error.id]).toEqual(ids);
		expect(label.htmlFor).toBe(control.id);
	});

	test("reflects disabled fieldset ancestry including the first legend exception", async () => {
		const fieldset = append(document.createElement("fieldset"));
		const legend = document.createElement("legend");
		const field = create();
		field.element.remove();
		legend.append(field.element);
		fieldset.append(legend);
		fieldset.disabled = true;

		expect(field.element.disabled).toBe(false);
		fieldset.append(field.element);
		await mutation();
		expect(field.element.disabled).toBe(true);
		expect(field.element.matches(":state(disabled)")).toBe(true);

		fieldset.disabled = false;
		await mutation();
		expect(field.element.disabled).toBe(false);
	});

	test("uses an Base FACE control as the sole label and submission owner", () => {
		const checkboxName = `base-checkbox-${crypto.randomUUID()}`;
		customElements.define(checkboxName, class extends CheckboxElement {});
		const checkbox = document.createElement(checkboxName) as CheckboxElement;
		checkbox.name = "accepted";
		checkbox.required = true;
		const form = append(document.createElement("form"));
		const { element, label } = create(checkbox);
		element.remove();
		form.append(element);

		expect(element.control).toBe(checkbox);
		expect(element.invalid).toBe(true);
		expect([...form.elements]).toEqual([checkbox]);
		expect([...new FormData(form)]).toEqual([]);
		label.click();
		expect(checkbox.checked).toBe(true);
		expect(element.filled).toBe(true);
		expect(element.dirty).toBe(true);
		expect([...new FormData(form)]).toEqual([["accepted", "on"]]);
	});

	test("resolves actual Number and OTP inputs without treating wrapper buttons as controls", async () => {
		const numberName = `base-number-field-${crypto.randomUUID()}`;
		const otpName = `base-otp-field-${crypto.randomUUID()}`;
		customElements.define(numberName, class extends NumberFieldElement {});
		customElements.define(otpName, class extends OTPFieldElement {});

		const form = append(document.createElement("form"));
		const number = document.createElement(numberName) as NumberFieldElement;
		const numberInput = document.createElement("input");
		const decrement = document.createElement("button");
		const increment = document.createElement("button");
		numberInput.type = "number";
		numberInput.name = "quantity";
		numberInput.value = "2";
		decrement.slot = "decrement";
		increment.slot = "increment";
		number.append(decrement, numberInput, increment);
		const numberField = create(number);
		numberField.element.remove();
		form.append(numberField.element);

		expect(numberField.element.control).toBe(numberInput);
		expect(numberField.label.control).toBe(numberInput);
		expect(numberField.element.control).not.toBe(decrement);
		expect(numberField.element.control).not.toBe(increment);
		expect([...new FormData(form)]).toEqual([["quantity", "2"]]);

		const oldId = numberInput.id;
		const replacement = document.createElement("input");
		replacement.type = "number";
		replacement.name = "quantity";
		replacement.value = "3";
		numberInput.replaceWith(replacement);
		await mutation();
		expect(numberField.element.control).toBe(replacement);
		expect(numberInput.hasAttribute("id")).toBe(false);
		expect(replacement.id).not.toBe("");
		expect(numberField.label.control).toBe(replacement);
		expect(numberField.label.htmlFor).not.toBe(oldId);
		expect([...new FormData(form)]).toEqual([["quantity", "3"]]);

		const otp = document.createElement(otpName) as OTPFieldElement;
		const otpInput = document.createElement("input");
		otpInput.name = "code";
		otpInput.value = "123456";
		otp.append(otpInput);
		const otpField = create(otp);
		otpField.element.remove();
		form.append(otpField.element);
		expect(otpField.element.control).toBe(otpInput);
		expect(otpField.label.control).toBe(otpInput);
		expect([...new FormData(form)]).toEqual([
			["quantity", "3"],
			["code", "123456"],
		]);
	});

	test("accepts only a wrapper's contained light-DOM native input and recovers from a hostile getter", () => {
		const adapterName = `field-input-adapter-${crypto.randomUUID()}`;
		let inaccessible = true;
		customElements.define(
			adapterName,
			class extends HTMLElement {
				get input(): HTMLInputElement | null {
					if (inaccessible) {
						throw new Error("input unavailable");
					}
					return this.querySelector("input");
				}
			},
		);
		const field = create();
		const original = field.control as HTMLInputElement;
		const originalId = original.id;
		const adapter = document.createElement(adapterName);
		const input = document.createElement("input");
		adapter.slot = "control";
		adapter.append(input);
		original.replaceWith(adapter);

		expect(() => field.element.refresh()).toThrowError("input unavailable");
		expect(original.id).toBe(originalId);
		expect(field.label.htmlFor).toBe(originalId);
		expect(input.hasAttribute("id")).toBe(false);

		inaccessible = false;
		field.element.refresh();
		expect(field.element.control).toBe(input);
		expect(original.hasAttribute("id")).toBe(false);
		expect(field.label.control).toBe(input);
		input.value = "changed";
		field.element.refresh();
		expect(field.element.dirty).toBe(true);

		const external = document.createElement("input");
		append(external);
		Object.defineProperty(adapter, "input", { configurable: true, get: () => external });
		field.element.refresh();
		expect(field.element.control).toBeNull();
		expect(external.hasAttribute("id")).toBe(false);

		const unadapted = document.createElement("div");
		unadapted.append(document.createElement("input"));
		expect(create(unadapted).element.control).toBeNull();

		const shadowName = `field-shadow-input-adapter-${crypto.randomUUID()}`;
		customElements.define(
			shadowName,
			class extends HTMLElement {
				#input = this.attachShadow({ mode: "closed" }).appendChild(this.ownerDocument.createElement("input"));

				get input() {
					return this.#input;
				}
			},
		);
		expect(create(document.createElement(shadowName)).element.control).toBeNull();
	});

	test("resolves a late-upgraded input adapter only on demand", () => {
		const name = `late-field-input-adapter-${crypto.randomUUID()}`;
		const adapter = document.createElement(name);
		const input = document.createElement("input");
		adapter.append(input);
		const field = create(adapter);
		expect(field.element.control).toBeNull();
		expect(field.label.hasAttribute("for")).toBe(false);

		customElements.define(
			name,
			class extends HTMLElement {
				get input() {
					return this.querySelector("input");
				}
			},
		);
		expect(field.label.hasAttribute("for")).toBe(false);
		field.element.refresh();
		expect(field.element.control).toBe(input);
		expect(field.label.control).toBe(input);
	});

	test("snapshots a FACE control's values array before its scalar value", () => {
		const name = `field-array-control-${crypto.randomUUID()}`;
		class ArrayControl extends HTMLElement {
			static readonly formAssociated = true;
			#internals = this.attachInternals();
			values: readonly string[] = Object.freeze([]);

			get form() {
				return this.#internals.form;
			}

			get validationMessage() {
				return this.#internals.validationMessage;
			}

			get validity() {
				return this.#internals.validity;
			}

			get willValidate() {
				return this.#internals.willValidate;
			}

			get value() {
				throw new Error("scalar value must not be read while values is available");
			}

			checkValidity() {
				return this.#internals.checkValidity();
			}

			reportValidity() {
				return this.#internals.reportValidity();
			}

			setCustomValidity(message: string) {
				this.#internals.setValidity(message ? { customError: true } : {}, message);
			}
		}
		customElements.define(name, ArrayControl);
		const control = document.createElement(name) as ArrayControl;
		const { element } = create(control);

		expect(element.filled).toBe(false);
		expect(element.dirty).toBe(false);
		control.values = Object.freeze([""]);
		element.refresh();
		expect(element.filled).toBe(true);
		expect(element.dirty).toBe(true);

		control.values = Object.freeze(["same", "first"]);
		element.resetState();
		control.values = Object.freeze(["same", "second"]);
		element.refresh();
		expect(element.dirty).toBe(true);
	});

	test("tracks closed-shadow focus and reacquires owner-realm resources after adoption", async () => {
		const controlName = `closed-field-control-${crypto.randomUUID()}`;
		class ClosedControl extends HTMLElement {
			static readonly formAssociated = true;
			#input = this.ownerDocument.createElement("input");
			#internals = this.attachInternals();

			constructor() {
				super();
				this.attachShadow({ mode: "closed" }).append(this.#input);
			}

			get form() {
				return this.#internals.form;
			}

			get validationMessage() {
				return this.#internals.validationMessage;
			}

			get validity() {
				return this.#internals.validity;
			}

			get willValidate() {
				return this.#internals.willValidate;
			}

			get value() {
				return this.#input.value;
			}

			checkValidity() {
				return this.#internals.checkValidity();
			}

			reportValidity() {
				return this.#internals.reportValidity();
			}

			setCustomValidity(message: string) {
				this.#internals.setValidity(message ? { customError: true } : {}, message);
			}

			focusInner() {
				this.#input.focus();
			}
		}
		customElements.define(controlName, ClosedControl);
		const control = document.createElement(controlName) as ClosedControl;
		const field = create(control);
		const outside = append(document.createElement("button"));
		control.focusInner();
		expect(document.activeElement).toBe(control);
		expect(field.element.focused).toBe(true);
		outside.focus();
		await mutation();
		expect(field.element.touched).toBe(true);

		const frame = append(document.createElement("iframe"));
		const foreignDocument = frame.contentDocument!;
		foreignDocument.body.append(foreignDocument.adoptNode(field.element));
		expect(field.element.ownerDocument).toBe(foreignDocument);
		expect(field.element.control).toBe(control);
		expect(field.label.htmlFor).toBe(control.id);
		control.focusInner();
		expect(foreignDocument.activeElement).toBe(control);
		expect(field.element.focused).toBe(true);
	});
});
