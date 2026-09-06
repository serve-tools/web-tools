import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { MenuElement } from "../../src/MenuElement.js";
import { ToolbarElement } from "../../src/ToolbarElement.js";

const fixtures: Element[] = [];
const wait = () => new Promise<void>((resolve) => setTimeout(resolve));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = () => {
	const name = `base-toolbar-${crypto.randomUUID()}`;
	customElements.define(name, class extends ToolbarElement {});
	const element = document.createElement(name) as ToolbarElement;
	const first = document.createElement("button");
	first.textContent = "Undo";
	const input = document.createElement("input");
	input.value = "100";
	input.ariaLabel = "Zoom";
	const link = document.createElement("a");
	link.href = "#help";
	link.textContent = "Help";
	element.append(first, input, link);
	document.body.append(element);
	fixtures.push(element);
	return { element, first, input, link };
};

describe("ToolbarElement", () => {
	test("creates one roving tab stop across direct native controls", () => {
		const { element, first, input, link } = create();
		expect(element.items).toEqual([first, input, link]);
		expect([first.tabIndex, input.tabIndex, link.tabIndex]).toEqual([0, -1, -1]);
	});

	test("excludes hidden controls from roving focus and handles one-item navigation", async () => {
		const { element, first, input, link } = create();
		expect(element.focusItem(input)).toBe(true);
		input.type = "hidden";
		await wait();
		expect(input.tabIndex).toBe(-1);
		expect(first.tabIndex).toBe(0);
		input.remove();
		link.remove();
		await wait();
		first.focus();
		for (const key of ["ArrowRight", "Home", "End"]) {
			const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
			first.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
		}
	});

	test("does not retain an outer inert ancestor as composite-owned availability", async () => {
		const wrapper = document.createElement("div");
		wrapper.inert = true;
		document.body.append(wrapper);
		fixtures.push(wrapper);
		const { element, first } = create();
		wrapper.append(element);
		expect(first.tabIndex).toBe(0);
		wrapper.inert = false;
		await wait();
		expect(first.tabIndex).toBe(0);
	});

	test("supports arrow, Home, End, looping, and RTL", async () => {
		const { element, first, input, link } = create();
		first.focus();
		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(link);
		await userEvent.keyboard("{Home}");
		expect(document.activeElement).toBe(first);
		element.dir = "rtl";
		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(input);
	});

	test("preserves input arrows until a collapsed caret reaches the relevant edge", async () => {
		const { input, link } = create();
		input.focus();
		input.setSelectionRange(1, 1);
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(input);
		input.setSelectionRange(input.value.length, input.value.length);
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(link);
	});

	test("moves past checkbox inputs while preserving range and number arrow behavior", async () => {
		const { element, first } = create();
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		const range = document.createElement("input");
		range.type = "range";
		const number = document.createElement("input");
		number.type = "number";
		const radio = document.createElement("input");
		radio.type = "radio";
		const email = document.createElement("input");
		email.type = "email";
		element.replaceChildren(first, checkbox, range, number, radio, email);
		await wait();
		first.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(checkbox);
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(range);
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(range);
		number.focus();
		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(number);
		radio.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(radio);
		email.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(email);
	});

	test("keeps roving state aligned when a focus listener redirects within the collection", async () => {
		const { first, input, link } = create();
		input.addEventListener("focus", () => link.focus(), { once: true });
		first.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(link);
		expect(link.tabIndex).toBe(0);
		expect(first.tabIndex).toBe(-1);
		expect(input.tabIndex).toBe(-1);

		const removal = create();
		removal.input.addEventListener(
			"focus",
			() => {
				removal.first.remove();
				removal.input.hidden = true;
			},
			{ once: true },
		);
		removal.first.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(removal.link.tabIndex).toBe(0);
		expect(removal.input.tabIndex).toBe(-1);
	});

	test("host and authored aria-disabled prevent activation while remaining focusable", () => {
		const { element, first, link } = create();
		let clicks = 0;
		let linkClicks = 0;
		first.addEventListener("click", () => ++clicks);
		link.addEventListener("click", () => ++linkClicks);
		element.disabled = true;
		first.click();
		expect(clicks).toBe(0);
		expect(first.ariaDisabled).toBe("true");
		element.disabled = false;
		expect(first.hasAttribute("aria-disabled")).toBe(false);
		link.ariaDisabled = "true";
		link.click();
		expect(linkClicks).toBe(0);
	});

	test("integrates a direct Menu trigger and discovers late upgrade", async () => {
		const toolbarTag = `base-toolbar-menu-${crypto.randomUUID()}`;
		const menuTag = `base-toolbar-late-menu-${crypto.randomUUID()}`;
		customElements.define(toolbarTag, class extends ToolbarElement {});
		const element = document.createElement(toolbarTag) as ToolbarElement;
		const menu = document.createElement(menuTag);
		const trigger = document.createElement("button");
		trigger.slot = "trigger";
		const popup = document.createElement("div");
		popup.popover = "auto";
		menu.append(trigger, popup);
		element.append(menu);
		document.body.append(element);
		fixtures.push(element);
		expect(element.items).toHaveLength(0);
		customElements.define(menuTag, class extends MenuElement {});
		await wait();
		expect(element.items).toEqual([trigger]);
		const replacement = document.createElement("button");
		replacement.slot = "trigger";
		trigger.replaceWith(replacement);
		expect(element.items).toEqual([replacement]);
		expect(trigger.hasAttribute("tabindex")).toBe(false);
	});

	test("gives a vertical toolbar axis precedence over a direct Menu trigger", async () => {
		const toolbarTag = `base-toolbar-vertical-${crypto.randomUUID()}`;
		const menuTag = `base-toolbar-vertical-menu-${crypto.randomUUID()}`;
		customElements.define(toolbarTag, class extends ToolbarElement {});
		customElements.define(menuTag, class extends MenuElement {});
		const element = document.createElement(toolbarTag) as ToolbarElement;
		element.orientation = "vertical";
		const menu = document.createElement(menuTag) as MenuElement;
		const trigger = document.createElement("button");
		trigger.slot = "trigger";
		const popup = document.createElement("div");
		popup.popover = "auto";
		const item = document.createElement("button");
		item.role = "menuitem";
		popup.append(item);
		menu.append(trigger, popup);
		trigger.popoverTargetElement = popup;
		const next = document.createElement("button");
		element.append(menu, next);
		document.body.append(element);
		fixtures.push(element);
		trigger.focus();
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(next);
		expect(menu.open).toBe(false);
	});

	test("restores authored tabindex and aria-disabled on disconnect and replacement", async () => {
		const { element, first } = create();
		first.tabIndex = 7;
		first.ariaDisabled = "mixed";
		await wait();
		element.disabled = true;
		expect(first.tabIndex).toBe(0);
		element.remove();
		expect(first.tabIndex).toBe(7);
		expect(first.ariaDisabled).toBe("mixed");
	});
});
