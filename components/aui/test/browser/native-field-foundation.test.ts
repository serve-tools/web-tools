import { afterEach, describe, expect, test, vi } from "vitest";
import { NativeFieldElement, setNativeFieldState, synchronizeNativeFieldAttributes } from "../../src/.native-field.js";
import { isDirectInput } from "../../src/.numeric.js";
import { AttributeOwner } from "../../src/.ownership.js";
import { AUIElement } from "../../src/aui-element.js";
import { NumberFieldElement } from "../../src/number-field-element.js";
import { html } from "../../src/template.js";

const fixtures: Element[] = [];
const mutation = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

class TestNativeFieldElement extends NativeFieldElement {
	static readonly observedAttributes = ["disabled", "readonly", "required"];

	#input: HTMLInputElement | undefined;
	#internals = this.attachInternals();
	#owned = new AttributeOwner();

	get input(): HTMLInputElement | null {
		this.#refresh();
		return this.#input ?? null;
	}

	protected override layout() {
		return html`<slot></slot>`;
	}

	attributeChangedCallback(): void {
		this.#synchronize();
	}

	protected override connect(): void {
		this.#refresh();
	}

	#refresh(): void {
		const input = [...this.children].find(
			(child): child is HTMLInputElement =>
				isDirectInput(this, child) && child.slot === "" && child.type === "text",
		);
		if (this.#input !== input) {
			if (this.#input) {
				this.#owned.release(this.#input);
			}
			this.#input = input;
		}
		this.#synchronize();
	}

	#synchronize(): void {
		synchronizeNativeFieldAttributes(this, this.#input, this.#owned);
		setNativeFieldState(this.#internals, "disabled", this.#input?.disabled ?? this.disabled);
		setNativeFieldState(this.#internals, "readonly", this.#input?.readOnly ?? this.readOnly);
		setNativeFieldState(this.#internals, "invalid", this.#input ? !this.#input.validity.valid : false);
	}
}

const define = <ElementType extends NativeFieldElement = TestNativeFieldElement>(
	constructor?: new () => ElementType,
): ElementType => {
	const name = `aui-native-field-${crypto.randomUUID()}`;
	customElements.define(name, constructor ?? class extends TestNativeFieldElement {});
	return document.createElement(name) as ElementType;
};

const append = <ElementType extends Element>(element: ElementType): ElementType => {
	document.body.append(element);
	fixtures.push(element);
	return element;
};

describe("NativeFieldElement", () => {
	test("keeps one accepted native input as the form, value, validity, and focus owner", () => {
		const form = append(document.createElement("form"));
		const element = define();
		const rejected = document.createElement("input");
		const input = document.createElement("input");
		rejected.type = "number";
		input.name = "field";
		input.readOnly = true;
		element.disabled = true;
		element.required = true;
		element.append(rejected, input);
		form.append(element);

		expect(element.input).toBe(input);
		expect(input.disabled).toBe(true);
		expect(input.required).toBe(true);
		expect(input.readOnly).toBe(true);
		expect(element.validity).toBe(input.validity);
		expect([...form.elements]).toEqual([rejected, input]);
		expect(element.matches(":state(disabled)")).toBe(true);
		expect(element.matches(":state(readonly)")).toBe(true);

		const events = vi.fn();
		input.addEventListener("input", events);
		input.value = "current";
		element.disabled = false;
		input.focus();
		expect(document.activeElement).toBe(input);
		expect(new FormData(form).get("field")).toBe("current");
		expect(events).not.toHaveBeenCalled();

		element.disabled = true;
		const replacement = document.createElement("input");
		replacement.name = "field";
		input.replaceWith(replacement);
		expect(element.input).toBe(replacement);
		expect(input.disabled).toBe(false);
		expect(input.required).toBe(false);
		expect(input.readOnly).toBe(true);
		expect(replacement.disabled).toBe(true);
		expect(replacement.required).toBe(true);
	});

	test("applies a pending value before a same-task reset in the adopted form's realm", async () => {
		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument as Document;
		const element = define(class extends NumberFieldElement {});
		append(element);
		element.value = "9";

		const form = frameDocument.createElement("form");
		frameDocument.body.append(form);
		form.append(element);
		const input = frameDocument.createElement("input");
		input.type = "number";
		input.defaultValue = "2";
		element.append(input);
		form.reset();

		await mutation();
		expect(element.input).toBe(input);
		expect(element.value).toBe("2");
	});

	test("cleans observation and subclass listeners when connection setup fails", async () => {
		let fail = true;
		const element = define(
			class extends NumberFieldElement {
				override connectedCallback(): void {}

				protected override connect(connection: AUIElement.Connection): void {
					super.connect(connection);
					if (fail) {
						throw new Error("setup failed");
					}
				}
			},
		);
		const input = document.createElement("input");
		const increment = document.createElement("button");
		input.type = "number";
		input.value = "2";
		increment.slot = "increment";
		element.append(input, increment);
		append(element);

		expect(() => AUIElement.prototype.connectedCallback.call(element)).toThrow("setup failed");
		input.readOnly = true;
		increment.click();
		await mutation();
		expect(element.matches(":state(readonly)")).toBe(false);
		expect(input.value).toBe("2");

		fail = false;
		AUIElement.prototype.connectedCallback.call(element);
		expect(element.matches(":state(readonly)")).toBe(true);
		input.readOnly = false;
		await mutation();
		expect(element.matches(":state(readonly)")).toBe(false);
		increment.click();
		expect(input.value).toBe("3");
	});
});
