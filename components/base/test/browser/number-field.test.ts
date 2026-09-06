import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { NumberFieldChangeDetail } from "../../src/NumberFieldElement.js";
import { NumberFieldElement } from "../../src/NumberFieldElement.js";

const fixtures: Node[] = [];
const mutation = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

afterEach(() => {
	vi.useRealTimers();
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

const define = (): NumberFieldElement => {
	const name = `base-number-field-${crypto.randomUUID()}`;
	customElements.define(name, class extends NumberFieldElement {});
	return document.createElement(name) as NumberFieldElement;
};

const create = () => {
	const element = define();
	const decrement = document.createElement("button");
	decrement.slot = "decrement";
	const input = document.createElement("input");
	input.type = "number";
	input.name = "quantity";
	input.value = "2";
	const increment = document.createElement("button");
	increment.slot = "increment";
	element.append(decrement, input, increment);
	append(element);
	return { decrement, element, increment, input };
};

describe("NumberFieldElement", () => {
	test("retains one direct number input as the focus, validation, and form identity", () => {
		const { element, input } = create();
		const form = append(document.createElement("form"));
		form.append(element);

		input.focus();
		expect(element.input).toBe(input);
		expect(document.activeElement).toBe(input);
		expect(element.tabIndex).toBe(-1);
		expect(new FormData(form).get("quantity")).toBe("2");
		expect(element.validity).toBe(input.validity);
	});

	test("reversibly coordinates constraints and authored button state", async () => {
		const { decrement, element, input } = create();
		input.min = "-10";
		input.step = "0.5";
		decrement.type = "submit";
		decrement.disabled = true;
		element.min = "0";
		element.max = "9";
		element.step = "3";
		element.required = true;

		expect(input.min).toBe("0");
		expect(input.max).toBe("9");
		expect(input.step).toBe("3");
		expect(input.required).toBe(true);
		expect(decrement.type).toBe("button");
		expect(decrement.disabled).toBe(true);

		input.remove();
		decrement.remove();
		await mutation();
		expect(input.min).toBe("-10");
		expect(input.max).toBe("");
		expect(input.step).toBe("0.5");
		expect(input.required).toBe(false);
		expect(decrement.type).toBe("submit");
		expect(decrement.disabled).toBe(true);
	});

	test("keeps programmatic value and native step methods silent", () => {
		const { element, input } = create();
		const events = vi.fn();
		input.addEventListener("input", events);
		input.addEventListener("change", events);

		element.value = "4";
		element.stepUp(2);
		expect(element.value).toBe("6");
		element.stepDown();
		expect(element.valueAsNumber).toBe(5);
		expect(events).not.toHaveBeenCalled();
		expect(() => ((element as unknown as { valueAsNumber: bigint }).valueAsNumber = 1n)).toThrow(TypeError);
	});

	test("emits a cancelable proposal only for authored Base step actions", () => {
		const { element, increment, input } = create();
		const sequence: string[] = [];
		let detail: NumberFieldChangeDetail | undefined;
		element.addEventListener("beforechange", (event) => {
			sequence.push(event.type);
			detail = event.detail;
		});
		input.addEventListener("input", (event) => sequence.push(event.type));
		input.addEventListener("change", (event) => sequence.push(event.type));

		increment.click();
		expect(input.value).toBe("3");
		expect(sequence).toEqual(["beforechange", "input", "change"]);
		expect(detail?.direction).toBe("increment");
		expect(detail?.valueAsNumber).toBe(3);
		expect(Object.isFrozen(detail)).toBe(true);

		sequence.length = 0;
		input.value = "7";
		input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText" }));
		expect(sequence).toEqual(["input"]);
	});

	test("honors cancellation and supports step=any with one-unit Base button steps", () => {
		const { element, increment, input } = create();
		element.step = "any";
		element.addEventListener("beforechange", (event) => event.preventDefault(), { once: true });
		increment.click();
		expect(input.value).toBe("2");
		increment.click();
		expect(input.value).toBe("3");
		expect(() => element.stepUp()).toThrow();
	});

	test("suppresses the click belonging to a canceled primary pointer activation", async () => {
		const { element, increment, input } = create();
		element.addEventListener("beforechange", (event) => event.preventDefault(), { once: true });
		await userEvent.click(increment);
		expect(input.value).toBe("2");
	});

	test("guards proposal, input, and terminal change as one synchronous action", () => {
		const { increment, input } = create();
		const changes = vi.fn();
		input.addEventListener(
			"input",
			() => {
				increment.click();
			},
			{ once: true },
		);
		input.addEventListener("change", changes);
		increment.click();
		expect(input.value).toBe("3");
		expect(changes).toHaveBeenCalledTimes(1);
	});

	test("aborts proposals that cross disconnect or adoption connection epochs", () => {
		const { element, increment, input } = create();
		element.addEventListener(
			"beforechange",
			() => {
				element.remove();
				append(element);
			},
			{ once: true },
		);
		increment.click();
		expect(input.value).toBe("2");

		const frame = append(document.createElement("iframe"));
		const frameBody = frame.contentDocument?.body;
		expect(frameBody).toBeDefined();
		element.addEventListener("beforechange", () => frameBody?.append(element), { once: true });
		increment.click();
		expect(input.value).toBe("2");
	});

	test("uses the native default-value step base and aborts stale proposals", () => {
		const { element, increment, input } = create();
		input.defaultValue = "0.2";
		input.value = "1.2";
		element.step = "1";
		increment.click();
		expect(input.value).toBe("2.2");

		element.addEventListener(
			"beforechange",
			() => {
				input.min = "5";
			},
			{ once: true },
		);
		increment.click();
		expect(input.value).toBe("2.2");
	});

	test("repeats a held pointer action and releases timers on pointer end and disconnect", () => {
		vi.useFakeTimers();
		const { element, increment, input } = create();
		const changes = vi.fn();
		input.addEventListener("change", changes);

		increment.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 7 }));
		expect(input.value).toBe("3");
		vi.advanceTimersByTime(560);
		expect(input.valueAsNumber).toBeGreaterThan(3);
		document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }));
		expect(changes).toHaveBeenCalledTimes(1);
		element.remove();
		expect(vi.getTimerCount()).toBe(0);
		const settled = input.value;
		vi.advanceTimersByTime(500);
		expect(input.value).toBe(settled);

		append(element);
		increment.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 8 }));
		element.remove();
		const disconnected = input.value;
		vi.advanceTimersByTime(1000);
		expect(input.value).toBe(disconnected);
	});

	test("does not acquire a repeat timer when beforechange disconnects the field", () => {
		vi.useFakeTimers();
		const { element, increment, input } = create();
		element.addEventListener("beforechange", () => element.remove(), { once: true });

		increment.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 9 }));
		expect(input.value).toBe("2");
		expect(vi.getTimerCount()).toBe(0);
	});

	test("ends repeat in capture even when pointerup propagation is stopped", () => {
		vi.useFakeTimers();
		const { increment, input } = create();
		increment.addEventListener("pointerup", (event) => event.stopPropagation());
		increment.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 10 }));
		vi.advanceTimersByTime(500);
		increment.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 10 }));
		const settled = input.value;
		vi.advanceTimersByTime(500);
		expect(input.value).toBe(settled);
	});

	test("defers naturally to native fieldset disabledness and readonly editing", () => {
		const { element, increment, input } = create();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.disabled = true;
		fieldset.append(element);
		expect(element.input).toBe(input);
		increment.click();
		expect(input.value).toBe("2");

		fieldset.disabled = false;
		expect(increment.disabled).toBe(false);
		increment.click();
		expect(input.value).toBe("3");
		element.readOnly = true;
		increment.click();
		expect(input.value).toBe("3");
		expect(input.readOnly).toBe(true);
	});

	test("replays a value assigned before custom-element upgrade", () => {
		const name = `base-number-field-${crypto.randomUUID()}`;
		const element = document.createElement(name) as NumberFieldElement;
		(element as unknown as { value: string }).value = "8";
		const input = document.createElement("input");
		input.type = "number";
		element.append(input);
		append(element);
		customElements.define(name, class extends NumberFieldElement {});
		expect(element.value).toBe("8");
		expect(input.value).toBe("8");
	});

	test("uses native number conversion before an input is available", () => {
		const element = define();
		element.value = "not a number";
		expect(element.value).toBe("");
		expect(() => ((element as unknown as { valueAsNumber: bigint }).valueAsNumber = 1n)).toThrow(TypeError);
	});

	test("does not mutate native children when a later recovered property fails upgrade", () => {
		const name = `base-number-field-${crypto.randomUUID()}`;
		const fixture = append(document.createElement("div"));
		fixture.innerHTML = `<${name}><button slot="increment" type="submit">+</button><input type="number" min="-5" value="2"></${name}>`;
		const element = fixture.firstElementChild as HTMLElement & { value: string; valueAsNumber: bigint };
		const button = element.firstElementChild as HTMLButtonElement;
		const input = element.lastElementChild as HTMLInputElement;
		element.value = "3";
		element.valueAsNumber = 1n;
		let upgradeError: unknown;
		const onError = (event: ErrorEvent) => {
			if (event.error instanceof TypeError) {
				upgradeError = event.error;
				event.preventDefault();
				event.stopImmediatePropagation();
			}
		};
		window.addEventListener("error", onError, true);
		try {
			customElements.define(name, class extends NumberFieldElement {});
		} catch (error) {
			upgradeError = error;
		} finally {
			window.removeEventListener("error", onError, true);
		}
		expect(upgradeError).toBeInstanceOf(TypeError);
		expect(input.value).toBe("2");
		expect(input.min).toBe("-5");
		expect(button.type).toBe("submit");
	});

	test("clears input-derived states when the controlled input leaves", async () => {
		const { element, input } = create();
		input.readOnly = true;
		expect(element.value).toBe("2");
		expect(element.matches(":state(readonly)")).toBe(true);
		input.readOnly = false;
		input.required = true;
		input.value = "";
		expect(element.value).toBe("");
		expect(element.matches(":state(invalid)")).toBe(true);
		input.remove();
		await mutation();
		expect(element.matches(":state(readonly)")).toBe(false);
		expect(element.matches(":state(invalid)")).toBe(false);
	});

	test("refreshes snapshots after silent native setters and form reset without synthesizing events", () => {
		const { element, input } = create();
		input.defaultValue = "2";
		const form = append(document.createElement("form"));
		form.append(element);
		const events = vi.fn();
		input.addEventListener("input", events);
		input.addEventListener("change", events);
		input.value = "7";
		expect(element.value).toBe("7");
		form.reset();
		expect(input.value).toBe("2");
		expect(element.value).toBe("2");
		expect(events).not.toHaveBeenCalled();
	});

	test("lets a later same-task form reset win over a pending host value", async () => {
		const element = define();
		const form = append(document.createElement("form"));
		form.append(element);
		element.value = "9";
		const input = document.createElement("input");
		input.type = "number";
		input.defaultValue = "2";
		element.append(input);
		form.reset();
		await mutation();
		expect(element.value).toBe("2");
	});

	test("orders pending values before reset after adoption into a new event realm", async () => {
		const frame = append(document.createElement("iframe"));
		const frameDocument = frame.contentDocument as Document;
		const element = define();
		append(element);
		const form = frameDocument.createElement("form");
		frameDocument.body.append(form);
		form.append(element);
		element.value = "9";
		const input = frameDocument.createElement("input");
		input.type = "number";
		input.defaultValue = "2";
		element.append(input);
		form.reset();
		await mutation();
		expect(element.value).toBe("2");
	});

	test("releases and reacquires ownership when document capture moves the native input", async () => {
		const first = create();
		first.element.min = "0";
		const second = define();
		second.min = "5";
		append(second);
		const move = (event: Event) => {
			if (event.target === first.input) {
				second.append(first.input);
			}
		};
		document.addEventListener("input", move, { capture: true, once: true });
		first.input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
		await mutation();
		expect(second.input).toBe(first.input);
		expect(first.input.min).toBe("5");
	});

	test("does not propose from a button moved away during document capture", () => {
		const first = create();
		const second = create();
		const proposals = vi.fn();
		first.element.addEventListener("beforechange", proposals);
		document.addEventListener(
			"click",
			(event) => {
				if (event.target === first.increment) {
					second.element.append(first.increment);
				}
			},
			{ capture: true, once: true },
		);
		first.increment.click();
		expect(proposals).not.toHaveBeenCalled();
		expect(first.input.value).toBe("2");
		expect(second.input.value).toBe("2");
	});

	test("rejects pointer and click events canceled before host capture", () => {
		const { element, increment, input } = create();
		const proposals = vi.fn();
		element.addEventListener("beforechange", proposals);
		document.addEventListener("pointerdown", (event) => event.preventDefault(), { capture: true, once: true });
		increment.dispatchEvent(
			new PointerEvent("pointerdown", { bubbles: true, button: 0, cancelable: true, pointerId: 11 }),
		);
		document.addEventListener("click", (event) => event.preventDefault(), { capture: true, once: true });
		increment.click();
		expect(input.value).toBe("2");
		expect(proposals).not.toHaveBeenCalled();
	});
});
