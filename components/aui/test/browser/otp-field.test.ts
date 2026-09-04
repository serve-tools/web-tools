import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { OTPFieldElement } from "../../src/otp-field-element.js";

const fixtures: Node[] = [];
const mutation = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const append = <NodeType extends Node>(node: NodeType): NodeType => {
	document.body.append(node);
	fixtures.push(node);
	return node;
};

const define = (): OTPFieldElement => {
	const name = `aui-otp-field-${crypto.randomUUID()}`;
	customElements.define(name, class extends OTPFieldElement {});
	return document.createElement(name) as OTPFieldElement;
};

const create = (length = 4) => {
	const element = define();
	element.length = length;
	const input = document.createElement("input");
	input.name = "code";
	input.pattern = `[0-9]{${length}}`;
	const segments = Array.from({ length }, () => {
		const segment = document.createElement("span");
		segment.slot = "segment";
		return segment;
	});
	element.append(input, ...segments);
	append(element);
	return { element, input, segments };
};

describe("OTPFieldElement", () => {
	test("uses one actual input for editing, validation, and form submission", () => {
		const { element, input } = create();
		const form = append(document.createElement("form"));
		form.append(element);
		input.value = "1234";

		input.focus();
		expect(element.input).toBe(input);
		expect(document.activeElement).toBe(input);
		expect(element.shadowRoot?.querySelector("input")).toBeNull();
		expect(new FormData(form).get("code")).toBe("1234");
		expect(element.validity).toBe(input.validity);
	});

	test("defaults autofill hints but preserves author overrides and restores removed inputs", async () => {
		const { input } = create();
		expect(input.getAttribute("autocomplete")).toBe("one-time-code");
		expect(input.getAttribute("inputmode")).toBe("numeric");
		expect(input.minLength).toBe(4);
		expect(input.maxLength).toBe(4);

		input.autocomplete = "off";
		input.inputMode = "text";
		await mutation();
		expect(input.getAttribute("autocomplete")).toBe("off");
		expect(input.getAttribute("inputmode")).toBe("text");
		input.remove();
		await mutation();
		expect(input.minLength).toBe(-1);
		expect(input.maxLength).toBe(-1);
		expect(input.getAttribute("autocomplete")).toBe("off");
	});

	test("uses native exact-length and authored pattern validation", async () => {
		const { element, input } = create();
		await userEvent.type(input, "12ab");
		expect(input.validity.patternMismatch).toBe(true);
		expect(element.checkValidity()).toBe(false);
		input.select();
		await userEvent.type(input, "1234");
		expect(input.validity.valid).toBe(true);
		expect(element.matches(":state(complete)")).toBe(true);
	});

	test("leaves beforeinput veto, composition, selection, and paste on the native editor", () => {
		const { input } = create();
		const beforeInput = vi.fn((event: InputEvent) => event.preventDefault());
		input.addEventListener("beforeinput", beforeInput);
		const proposal = new InputEvent("beforeinput", {
			bubbles: true,
			cancelable: true,
			composed: true,
			data: "7",
			inputType: "insertText",
		});
		expect(input.dispatchEvent(proposal)).toBe(false);
		expect(beforeInput).toHaveBeenCalledTimes(1);

		const composition = vi.fn();
		const paste = vi.fn();
		input.addEventListener("compositionstart", composition);
		input.addEventListener("paste", paste);
		input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "１" }));
		input.dispatchEvent(new ClipboardEvent("paste", { bubbles: true }));
		expect(composition).toHaveBeenCalledTimes(1);
		expect(paste).toHaveBeenCalledTimes(1);
	});

	test("mirrors value and selection to aria-hidden visual segments without replacing author content", async () => {
		const { element, input, segments } = create();
		for (const [index, segment] of segments.entries()) {
			segment.textContent = `segment ${index}`;
		}
		element.value = "42";
		input.focus();
		input.setSelectionRange(1, 1);
		input.dispatchEvent(new Event("select", { bubbles: true }));

		expect(segments.map((segment) => segment.getAttribute("data-value"))).toEqual(["4", "2", "", ""]);
		expect(segments[0].hasAttribute("data-filled")).toBe(true);
		expect(segments[1].hasAttribute("data-active")).toBe(true);
		expect(segments.every((segment) => segment.getAttribute("aria-hidden") === "true")).toBe(true);
		expect(segments.every((segment) => segment.hasAttribute("inert"))).toBe(true);
		expect(segments[0].textContent).toBe("segment 0");

		segments[0].remove();
		await mutation();
		expect(segments[0].hasAttribute("aria-hidden")).toBe(false);
		expect(segments[0].hasAttribute("inert")).toBe(false);
		expect(segments[0].hasAttribute("data-value")).toBe(false);
	});

	test("keeps programmatic values silent and does not synthesize autofill or input events", () => {
		const { element, input } = create();
		const events = vi.fn();
		input.addEventListener("beforeinput", events);
		input.addEventListener("input", events);
		input.addEventListener("change", events);
		element.value = "9876";
		expect(input.value).toBe("9876");
		expect(events).not.toHaveBeenCalled();
	});

	test("inherits fieldset disabledness and applies host readonly and required conveniences", () => {
		const { element, input } = create();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.disabled = true;
		fieldset.append(element);
		expect(input.matches(":disabled")).toBe(true);

		element.readOnly = true;
		element.required = true;
		expect(input.readOnly).toBe(true);
		expect(input.required).toBe(true);
	});

	test("replays a value assigned before custom-element upgrade", () => {
		const name = `aui-otp-field-${crypto.randomUUID()}`;
		const element = document.createElement(name) as OTPFieldElement;
		(element as unknown as { value: string }).value = "2468";
		const input = document.createElement("input");
		element.append(input);
		append(element);
		customElements.define(name, class extends OTPFieldElement {});
		expect(element.value).toBe("2468");
		expect(input.value).toBe("2468");
	});

	test("never promotes a visual slotted input to the editor identity", () => {
		const element = define();
		const visualInput = document.createElement("input");
		visualInput.slot = "segment";
		const editor = document.createElement("input");
		element.append(visualInput, editor);
		append(element);
		expect(element.input).toBe(editor);
		expect(visualInput.hasAttribute("inert")).toBe(true);
		expect(editor.hasAttribute("inert")).toBe(false);
	});

	test("makes non-HTML segments inert through their flat-tree wrapper", () => {
		const element = define();
		const editor = document.createElement("input");
		const visual = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		visual.setAttribute("slot", "segment");
		visual.setAttribute("tabindex", "0");
		element.append(editor, visual);
		append(element);
		editor.focus();
		visual.focus();
		expect(document.activeElement).toBe(editor);
		expect(element.shadowRoot?.querySelector("[part=segments]")?.hasAttribute("inert")).toBe(true);
	});

	test("does not let queued mirror work reclaim an editor moved during input", async () => {
		const first = create(4);
		const second = define();
		second.length = 6;
		append(second);
		document.addEventListener(
			"input",
			(event) => {
				if (event.target === first.input) {
					second.append(first.input);
					expect(second.input).toBe(first.input);
				}
			},
			{ capture: true, once: true },
		);
		first.input.value = "1234";
		first.input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
		await Promise.resolve();
		await mutation();
		expect(second.input).toBe(first.input);
		expect(first.input.minLength).toBe(6);
		expect(first.input.maxLength).toBe(6);
		expect(first.input.getAttribute("autocomplete")).toBe("one-time-code");
		expect(first.segments.every((segment) => segment.getAttribute("data-value") === "")).toBe(true);
	});

	test("clears editor-derived states when the editor leaves", async () => {
		const { element, input } = create();
		input.readOnly = true;
		input.value = "abcd";
		expect(element.value).toBe("abcd");
		expect(element.matches(":state(complete)")).toBe(true);
		expect(element.matches(":state(readonly)")).toBe(true);
		expect(element.matches(":state(invalid)")).toBe(true);
		input.remove();
		await mutation();
		expect(element.matches(":state(complete)")).toBe(false);
		expect(element.matches(":state(readonly)")).toBe(false);
		expect(element.matches(":state(invalid)")).toBe(false);
	});

	test("refreshes mirrors after silent native setters and form reset without synthetic events", () => {
		const { element, input, segments } = create();
		input.defaultValue = "1234";
		const form = append(document.createElement("form"));
		form.append(element);
		const events = vi.fn();
		input.addEventListener("input", events);
		input.addEventListener("change", events);
		input.value = "9876";
		expect(element.value).toBe("9876");
		expect(segments[0].getAttribute("data-value")).toBe("9");
		form.reset();
		expect(input.value).toBe("1234");
		expect(element.value).toBe("1234");
		expect(segments[0].getAttribute("data-value")).toBe("1");
		expect(events).not.toHaveBeenCalled();
	});

	test("lets a later same-task form reset win over a pending host value", async () => {
		const element = define();
		const form = append(document.createElement("form"));
		form.append(element);
		element.value = "9999";
		const input = document.createElement("input");
		input.defaultValue = "1234";
		element.append(input);
		form.reset();
		await mutation();
		expect(element.value).toBe("1234");
	});
});
