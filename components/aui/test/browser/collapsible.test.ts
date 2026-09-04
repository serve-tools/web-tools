import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { CollapsibleElement } from "../../src/collapsible-element.js";

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

const defineCollapsible = (): { element: CollapsibleElement; name: string } => {
	const name = `aui-collapsible-${crypto.randomUUID()}`;
	customElements.define(name, class extends CollapsibleElement {});
	return { element: document.createElement(name) as CollapsibleElement, name };
};

const create = (options: { heading?: boolean; open?: boolean } = {}) => {
	const { element, name } = defineCollapsible();
	const button = document.createElement("button");
	button.textContent = "Details";
	const heading = document.createElement("h3");
	if (options.heading ?? true) {
		heading.append(button);
		element.append(heading);
	} else {
		element.append(button);
	}
	const panel = document.createElement("section");
	panel.slot = "panel";
	panel.textContent = "Panel content";
	element.append(panel);
	if (options.open) {
		element.open = true;
	}
	append(element);
	return { button, element, heading, name, panel };
};

describe("CollapsibleElement", () => {
	test("links a direct heading button to a retained author panel", () => {
		const { button, element, heading, panel } = create();

		expect(element.button).toBe(button);
		expect(element.panel).toBe(panel);
		expect(element.firstElementChild).toBe(heading);
		expect(button.type).toBe("button");
		expect(button.getAttribute("aria-expanded")).toBe("false");
		expect(button.getAttribute("aria-controls")).toBe(panel.id);
		expect(panel.getAttribute("role")).toBe("region");
		expect(panel.getAttribute("aria-labelledby")).toBe(button.id);
		expect(panel.hidden).toBe(true);
		expect(element.matches(":state(closed)")).toBe(true);

		element.open = true;
		expect(element.open).toBe(true);
		expect(element.hasAttribute("open")).toBe(true);
		expect(button.getAttribute("aria-expanded")).toBe("true");
		expect(panel.hidden).toBe(false);
		expect(element.matches(":state(open)")).toBe(true);
		expect(panel.isConnected).toBe(true);
	});

	test("accepts a direct button and never captures buttons nested in the panel or deeper heading content", async () => {
		const direct = create({ heading: false });
		expect(direct.element.button).toBe(direct.button);

		const { element } = defineCollapsible();
		const heading = document.createElement("h3");
		const wrapper = document.createElement("span");
		const deepButton = document.createElement("button");
		const panel = document.createElement("section");
		const nestedButton = document.createElement("button");
		wrapper.append(deepButton);
		heading.append(wrapper);
		panel.slot = "panel";
		panel.append(nestedButton);
		element.append(heading, panel);
		append(element);

		expect(element.button).toBeNull();
		deepButton.click();
		nestedButton.click();
		expect(element.open).toBe(false);

		heading.append(deepButton);
		await mutation();
		expect(element.button).toBe(deepButton);
		deepButton.click();
		expect(element.open).toBe(true);
	});

	test("uses native button activation and emits one cancelable transaction and one input/change pair", async () => {
		const { button, element } = create();
		const events: string[] = [];
		let source: MouseEvent | undefined;
		element.addEventListener("beforechange", (event) => {
			events.push(event.type);
			expect(event.detail.open).toBe(!element.open);
			expect(event.bubbles).toBe(true);
			expect(event.composed).toBe(true);
			expect(Object.isFrozen(event.detail)).toBe(true);
			source = event.detail.sourceEvent;
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

		button.focus();
		await userEvent.keyboard("{Enter}");
		expect(element.open).toBe(true);
		expect(source).toBeInstanceOf(MouseEvent);
		expect(events).toEqual(["beforechange", "input", "change"]);

		events.length = 0;
		await userEvent.keyboard(" ");
		expect(element.open).toBe(false);
		expect(events).toEqual(["beforechange", "input", "change"]);
	});

	test("keeps property changes silent and honors cancellation and stale-transaction checks", () => {
		const { button, element } = create();
		const input = vi.fn();
		const change = vi.fn();
		element.addEventListener("input", input);
		element.addEventListener("change", change);

		element.open = true;
		element.open = false;
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();

		const cancel = (event: Event) => event.preventDefault();
		element.addEventListener("beforechange", cancel, { once: true });
		button.click();
		expect(element.open).toBe(false);

		element.addEventListener("beforechange", () => (element.open = true), { once: true });
		button.click();
		expect(element.open).toBe(true);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
	});

	test("blocks interaction while disabled without replacing the author's disabled state", () => {
		const { button, element } = create();
		element.disabled = true;
		expect(button.disabled).toBe(true);
		expect(element.matches(":state(disabled)")).toBe(true);
		button.click();
		expect(element.open).toBe(false);

		element.disabled = false;
		expect(button.disabled).toBe(false);
		button.disabled = true;
		expect(element.disabled).toBe(false);
		expect(button.disabled).toBe(true);
		button.click();
		expect(element.open).toBe(false);
	});

	test("leaves inherited fieldset eligibility on the native button", () => {
		const { button, element } = create();
		const fieldset = append(document.createElement("fieldset"));
		fieldset.append(element);
		expect(element.matches(":state(disabled)")).toBe(false);

		fieldset.disabled = true;
		expect(button.matches(":disabled")).toBe(true);
		expect(element.matches(":state(disabled)")).toBe(false);
		button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
		expect(element.open).toBe(false);

		fieldset.disabled = false;
		expect(button.matches(":disabled")).toBe(false);
		button.click();
		expect(element.open).toBe(true);
	});

	test("moves focus from panel content to the trigger before closing", () => {
		const { button, element, panel } = create({ open: true });
		const input = document.createElement("input");
		panel.append(input);
		input.focus();
		expect(document.activeElement).toBe(input);

		element.open = false;
		expect(document.activeElement).toBe(button);
		expect(panel.hidden).toBe(true);
	});

	test("does not blur focus a trigger-focus listener moved outside the panel", () => {
		const { button, element, panel } = create({ open: true });
		const panelInput = document.createElement("input");
		const outsideInput = append(document.createElement("input"));
		const outsideBlur = vi.fn();
		panel.append(panelInput);
		outsideInput.addEventListener("blur", outsideBlur);
		button.addEventListener("focus", () => outsideInput.focus(), { once: true });
		panelInput.focus();

		element.open = false;

		expect(document.activeElement).toBe(outsideInput);
		expect(outsideBlur).not.toHaveBeenCalled();
		expect(panel.hidden).toBe(true);
	});

	test("blurs panel focus synchronously when a disabled trigger cannot receive it", () => {
		const { button, element, panel } = create({ open: true });
		const input = document.createElement("input");
		const blur = vi.fn();
		panel.append(input);
		input.addEventListener("blur", blur);
		input.focus();
		element.disabled = true;

		element.open = false;

		expect(button.matches(":disabled")).toBe(true);
		expect(panel.hidden).toBe(true);
		expect(document.activeElement).not.toBe(input);
		expect(blur).toHaveBeenCalledOnce();
	});

	test("preserves a blur-listener reopen when disabled focus falls back from the panel", () => {
		const { element, panel } = create({ open: true });
		const input = document.createElement("input");
		panel.append(input);
		input.focus();
		element.disabled = true;
		input.addEventListener("blur", () => (element.open = true), { once: true });

		element.open = false;

		expect(element.open).toBe(true);
		expect(panel.hidden).toBe(false);
	});

	test("preserves a focus-listener reopen and suppresses stale user change events", () => {
		const direct = create({ open: true });
		const directInput = document.createElement("input");
		direct.panel.append(directInput);
		directInput.focus();
		direct.button.addEventListener("focus", () => (direct.element.open = true), { once: true });
		direct.element.open = false;
		expect(direct.element.open).toBe(true);
		expect(direct.panel.hidden).toBe(false);

		const interaction = create({ open: true });
		const interactionInput = document.createElement("input");
		const input = vi.fn();
		const change = vi.fn();
		interaction.panel.append(interactionInput);
		interactionInput.focus();
		interaction.element.addEventListener("input", input);
		interaction.element.addEventListener("change", change);
		interaction.button.addEventListener("focus", () => (interaction.element.open = true), { once: true });
		interaction.button.click();

		expect(interaction.element.open).toBe(true);
		expect(interaction.panel.hidden).toBe(false);
		expect(input).not.toHaveBeenCalled();
		expect(change).not.toHaveBeenCalled();
	});

	test("restores the latest author attributes when controlled nodes are replaced", async () => {
		const { button, element, panel } = create();
		button.setAttribute("type", "reset");
		button.setAttribute("aria-expanded", "mixed");
		panel.setAttribute("role", "group");
		panel.setAttribute("hidden", "until-found");
		await mutation();

		expect(button.type).toBe("button");
		expect(button.getAttribute("aria-expanded")).toBe("false");
		expect(panel.getAttribute("role")).toBe("region");
		expect(panel.getAttribute("hidden")).toBe("");

		const replacementButton = document.createElement("button");
		const replacementPanel = document.createElement("section");
		replacementPanel.slot = "panel";
		button.replaceWith(replacementButton);
		panel.replaceWith(replacementPanel);
		await mutation();

		expect(button.getAttribute("type")).toBe("reset");
		expect(button.getAttribute("aria-expanded")).toBe("mixed");
		expect(button.hasAttribute("aria-controls")).toBe(false);
		expect(panel.getAttribute("role")).toBe("group");
		expect(panel.getAttribute("hidden")).toBe("until-found");
		expect(element.button).toBe(replacementButton);
		expect(element.panel).toBe(replacementPanel);
	});

	test("supports parse-time and late upgrades, reconnection, and adoption without duplicate interaction", () => {
		const parsedName = `aui-collapsible-${crypto.randomUUID()}`;
		customElements.define(parsedName, class extends CollapsibleElement {});
		const fixture = append(document.createElement("div"));
		fixture.insertAdjacentHTML(
			"beforeend",
			`<${parsedName}><h4><button>Parsed</button></h4><section slot="panel">Panel</section></${parsedName}>`,
		);
		const parsed = fixture.lastElementChild as CollapsibleElement;
		expect(parsed.button?.textContent).toBe("Parsed");

		const lateName = `aui-collapsible-${crypto.randomUUID()}`;
		fixture.insertAdjacentHTML(
			"beforeend",
			`<${lateName}><button>Late</button><section slot="panel">Panel</section></${lateName}>`,
		);
		const late = fixture.lastElementChild as CollapsibleElement;
		customElements.define(lateName, class extends CollapsibleElement {});
		expect(late).toBeInstanceOf(CollapsibleElement);

		let changes = 0;
		late.addEventListener("change", () => ++changes);
		for (let index = 0; index < 3; ++index) {
			late.remove();
			fixture.append(late);
		}
		late.button?.click();
		expect(changes).toBe(1);

		const frame = append(document.createElement("iframe"));
		const foreignDocument = frame.contentDocument!;
		foreignDocument.body.append(foreignDocument.adoptNode(late));
		expect(late.ownerDocument).toBe(foreignDocument);
		late.button?.click();
		expect(changes).toBe(2);
	});
});
