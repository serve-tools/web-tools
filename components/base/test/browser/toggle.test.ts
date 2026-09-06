import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { ToggleChangeDetail } from "../../src/ToggleElement.js";
import { ToggleElement } from "../../src/ToggleElement.js";

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

const defineToggle = (): { element: ToggleElement; name: string } => {
	const name = `base-toggle-${crypto.randomUUID()}`;
	customElements.define(name, class extends ToggleElement {});
	return { element: document.createElement(name) as ToggleElement, name };
};

const create = (): { button: HTMLButtonElement; element: ToggleElement } => {
	const { element } = defineToggle();
	const button = document.createElement("button");
	button.textContent = "Bold";
	element.append(button);
	append(element);
	return { button, element };
};

describe("ToggleElement", () => {
	test("uses the first direct native button as its only activation and focus identity", () => {
		const { element } = defineToggle();
		const nestedContainer = document.createElement("div");
		const nested = document.createElement("button");
		const first = document.createElement("button");
		const second = document.createElement("button");
		nestedContainer.append(nested);
		element.append(nestedContainer, first, second);
		append(element);

		expect(element.button).toBe(first);
		expect(element.tabIndex).toBe(-1);
		expect(first.getAttribute("role")).toBe("button");
		expect(first.getAttribute("type")).toBe("button");
		expect(first.getAttribute("aria-pressed")).toBe("false");
		expect(second.hasAttribute("role")).toBe(false);
		expect(second.hasAttribute("aria-pressed")).toBe(false);

		second.click();
		nested.click();
		element.click();
		expect(element.pressed).toBe(false);
		first.click();
		expect(element.pressed).toBe(true);
	});

	test("owns native-button attributes without destroying authored values", async () => {
		const { element } = defineToggle();
		const first = document.createElement("button");
		const second = document.createElement("button");
		first.type = "submit";
		first.setAttribute("role", "menuitem");
		first.setAttribute("aria-pressed", "mixed");
		first.tabIndex = 4;
		element.append(first, second);
		append(element);

		expect(first.type).toBe("button");
		expect(first.getAttribute("role")).toBe("button");
		expect(first.getAttribute("aria-pressed")).toBe("false");
		first.type = "reset";
		first.setAttribute("role", "switch");
		await mutation();
		expect(first.type).toBe("button");
		expect(first.getAttribute("role")).toBe("button");

		first.remove();
		await mutation();
		expect(element.button).toBe(second);
		expect(first.type).toBe("reset");
		expect(first.getAttribute("role")).toBe("switch");
		expect(first.getAttribute("aria-pressed")).toBe("mixed");
		expect(first.tabIndex).toBe(4);
		expect(second.type).toBe("button");
	});

	test("prevents accidental form submission while preserving the author's button type", async () => {
		const { element } = defineToggle();
		const form = append(document.createElement("form"));
		const button = document.createElement("button");
		button.type = "submit";
		button.textContent = "Submit-looking toggle";
		element.append(button);
		form.append(element);
		const submit = vi.fn((event: SubmitEvent) => event.preventDefault());
		form.addEventListener("submit", submit);

		await userEvent.click(button);
		expect(element.pressed).toBe(true);
		expect(submit).not.toHaveBeenCalled();
		button.remove();
		await mutation();
		expect(button.type).toBe("submit");
	});

	test("emits one cancelable proposal followed by input and change for native activation", async () => {
		const { button, element } = create();
		const events: string[] = [];
		let detail: ToggleChangeDetail | undefined;
		element.addEventListener("beforechange", (event) => {
			events.push(event.type);
			detail = event.detail;
			expect(event.bubbles).toBe(true);
			expect(event.composed).toBe(true);
			expect(event.cancelable).toBe(true);
		});
		element.addEventListener("input", (event) => {
			events.push(event.type);
			expect(event.bubbles).toBe(true);
			expect(event.composed).toBe(true);
		});
		element.addEventListener("change", (event) => {
			events.push(event.type);
			expect(event.bubbles).toBe(true);
			expect(event.composed).toBe(false);
		});
		element.addEventListener("click", () => events.push("click"));

		await userEvent.click(button);
		expect(element.pressed).toBe(true);
		expect(events).toEqual(["beforechange", "input", "change", "click"]);
		expect(detail?.pressed).toBe(true);
		expect(detail?.sourceEvent).toBeInstanceOf(MouseEvent);
		expect(Object.isFrozen(detail)).toBe(true);

		events.length = 0;
		button.focus();
		await userEvent.keyboard("{Enter}");
		expect(element.pressed).toBe(false);
		expect(events).toEqual(["beforechange", "input", "change", "click"]);
		events.length = 0;
		await userEvent.keyboard(" ");
		expect(element.pressed).toBe(true);
		expect(events).toEqual(["beforechange", "input", "change", "click"]);
	});

	test("keeps programmatic state silent and reflects state to attributes, ARIA, and custom states", () => {
		const { button, element } = create();
		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);

		element.pressed = true;
		expect(element.hasAttribute("pressed")).toBe(true);
		expect(button.getAttribute("aria-pressed")).toBe("true");
		expect(element.matches(":state(pressed)")).toBe(true);
		element.removeAttribute("pressed");
		expect(element.pressed).toBe(false);
		expect(button.getAttribute("aria-pressed")).toBe("false");
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();

		element.disabled = true;
		expect(button.disabled).toBe(true);
		expect(element.matches(":state(disabled)")).toBe(true);
		expect(element.disabled).toBe(true);
	});

	test("honors cancellation, late invalidation, and reentrant activation without partial state", () => {
		const { button, element } = create();
		const parent = element.parentElement as HTMLElement;
		const events: string[] = [];
		const veto = (event: Event) => {
			events.push("ancestor");
			event.preventDefault();
		};
		parent.addEventListener("beforechange", veto);
		element.addEventListener("beforechange", () => events.push("toggle"));

		button.click();
		expect(events).toEqual(["toggle", "ancestor"]);
		expect(element.pressed).toBe(false);
		parent.removeEventListener("beforechange", veto);

		element.addEventListener(
			"beforechange",
			() => {
				button.click();
				element.disabled = true;
			},
			{ once: true },
		);
		button.click();
		expect(element.pressed).toBe(false);
		expect(element.disabled).toBe(true);
	});

	test("preserves authored and group-independent disabled state", () => {
		const { element } = defineToggle();
		const button = document.createElement("button");
		button.disabled = true;
		element.append(button);
		append(element);

		expect(element.disabled).toBe(false);
		expect(button.disabled).toBe(true);
		element.disabled = true;
		element.disabled = false;
		expect(element.disabled).toBe(false);
		expect(button.disabled).toBe(true);
		expect(element.matches(":state(disabled)")).toBe(true);
	});

	test("uses native fieldset disabledness for raw click eligibility without owning it", () => {
		const { element } = defineToggle();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.disabled = true;
		const button = document.createElement("button");
		element.append(button);
		fieldset.append(element);
		const click = () =>
			button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));

		click();
		expect(element.pressed).toBe(false);
		expect(button.hasAttribute("disabled")).toBe(false);
		expect(element.matches(":state(disabled)")).toBe(false);
		fieldset.disabled = false;
		click();
		expect(element.pressed).toBe(true);
		expect(button.hasAttribute("disabled")).toBe(false);
		expect(element.matches(":state(disabled)")).toBe(false);
	});

	test("upgrades pre-definition properties without emitting interaction events", () => {
		const name = `base-toggle-late-${crypto.randomUUID()}`;
		const element = document.createElement(name) as ToggleElement;
		const button = document.createElement("button");
		element.append(button);
		(element as unknown as { disabled: boolean }).disabled = true;
		(element as unknown as { pressed: boolean }).pressed = true;
		(element as unknown as { value: string }).value = "late";
		append(element);
		const input = vi.fn();
		element.addEventListener("input", input);

		customElements.define(name, class extends ToggleElement {});
		expect(element.pressed).toBe(true);
		expect(element.disabled).toBe(true);
		expect(element.value).toBe("late");
		expect(button.getAttribute("aria-pressed")).toBe("true");
		expect(input).not.toHaveBeenCalled();
	});

	test("supports cross-realm buttons and adopted activation without realm traps", () => {
		const iframe = append(document.createElement("iframe"));
		const foreignDocument = iframe.contentDocument as Document;
		const foreignWindow = iframe.contentWindow as Window & typeof globalThis;
		const { element } = defineToggle();
		const button = foreignDocument.createElement("button");
		element.append(button);
		append(element);

		expect(element.button).toBe(button);
		button.click();
		expect(element.pressed).toBe(true);

		foreignDocument.body.append(foreignDocument.adoptNode(element));
		button.click();
		expect(element.pressed).toBe(false);
		button.dispatchEvent(
			new foreignWindow.MouseEvent("click", { bubbles: true, cancelable: true, composed: true }),
		);
		expect(element.pressed).toBe(true);
	});

	test("reconnects without duplicate observers or interaction listeners", async () => {
		const { button, element } = create();
		const change = vi.fn();
		element.addEventListener("change", change);

		for (let index = 0; index < 4; ++index) {
			element.remove();
			document.body.append(element);
		}
		await mutation();
		button.click();
		expect(element.pressed).toBe(true);
		expect(change).toHaveBeenCalledOnce();
	});
});
