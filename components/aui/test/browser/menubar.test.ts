import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { MenuElement } from "../../src/menu-element.js";
import { MenubarElement } from "../../src/menubar-element.js";

const fixtures: Element[] = [];
const wait = () => new Promise<void>((resolve) => setTimeout(resolve));

// Do not let a previous test's real pointer hover a newly inserted menu trigger.
beforeEach(() => userEvent.hover(document.documentElement, { position: { x: 0, y: 0 } }));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const menu = (tag: string, label: string) => {
	const element = document.createElement(tag) as MenuElement;
	const trigger = document.createElement("button");
	trigger.slot = "trigger";
	trigger.textContent = label;
	const popup = document.createElement("div");
	popup.popover = "auto";
	const item = document.createElement("button");
	item.role = "menuitem";
	item.textContent = `${label} action`;
	popup.append(item);
	element.append(trigger, popup);
	trigger.popoverTargetElement = popup;
	return { element, item, popup, trigger };
};

const create = () => {
	const menuTag = `aui-menubar-menu-${crypto.randomUUID()}`;
	const barTag = `aui-menubar-${crypto.randomUUID()}`;
	customElements.define(menuTag, class extends MenuElement {});
	customElements.define(barTag, class extends MenubarElement {});
	const element = document.createElement(barTag) as MenubarElement;
	const first = menu(menuTag, "File");
	const second = menu(menuTag, "Edit");
	element.append(first.element, second.element);
	document.body.append(element);
	fixtures.push(element);
	return { element, first, second };
};

describe("MenubarElement", () => {
	test("owns menubar roles and one roving tab stop", async () => {
		const { element, first, second } = create();
		await wait();
		expect(element.items).toEqual([first.trigger, second.trigger]);
		expect(first.trigger.role).toBe("menuitem");
		expect([first.trigger.tabIndex, second.trigger.tabIndex]).toEqual([0, -1]);
	});

	test("moves horizontally with RTL and Home/End", async () => {
		const { element, first, second } = create();
		first.trigger.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(second.trigger);
		element.style.direction = "rtl";
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(first.trigger);
		await userEvent.keyboard("{End}");
		expect(document.activeElement).toBe(second.trigger);
	});

	test("gives a vertical menubar axis precedence and uses inline-end to open", async () => {
		const { element, first, second } = create();
		element.orientation = "vertical";
		first.trigger.focus();
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(second.trigger);
		expect(first.element.open).toBe(false);
		await userEvent.keyboard("{ArrowUp}");
		expect(document.activeElement).toBe(first.trigger);
		element.style.direction = "rtl";
		await userEvent.keyboard("{ArrowLeft}");
		await wait();
		expect(first.element.open).toBe(true);
		expect(document.activeElement).toBe(first.item);
		await userEvent.keyboard("{ArrowRight}");
		expect(first.element.open).toBe(false);
		expect(document.activeElement).toBe(first.trigger);
	});

	test("handles navigation keys when only one item is available", async () => {
		const { first, second } = create();
		second.element.remove();
		await wait();
		first.trigger.focus();
		for (const key of ["ArrowRight", "Home", "End"]) {
			const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
			first.trigger.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
		}
	});

	test("reassigns the raw roving stop after an in-place hidden mutation", async () => {
		const { first, second } = create();
		first.trigger.hidden = true;
		await wait();
		expect(first.trigger.tabIndex).toBe(-1);
		expect(second.trigger.tabIndex).toBe(0);
	});

	test("switches an open submenu from keyboard events relayed out of its popup", async () => {
		const { element, first, second } = create();
		await userEvent.click(first.trigger);
		await wait();
		expect(document.activeElement).toBe(first.item);
		await userEvent.keyboard("{ArrowRight}");
		await wait();
		expect(first.element.open).toBe(false);
		expect(second.element.open).toBe(true);
		expect(element.openMenu).toBe(second.element);
		expect(document.activeElement).toBe(second.trigger);
		second.element.hide();
	});

	test("keeps unmatched child typeahead inside the child popup", async () => {
		const { first, second } = create();
		first.element.show();
		await wait();
		expect(document.activeElement).toBe(first.item);
		await userEvent.keyboard("e");
		expect(document.activeElement).toBe(first.item);
		first.element.hide();
		first.trigger.focus();
		await userEvent.keyboard("e");
		expect(document.activeElement).toBe(second.trigger);
	});

	test("switches open menus on mouse hover without touch behavior", async () => {
		const { first, second } = create();
		first.element.show();
		await vi.waitFor(() => expect(document.activeElement).toBe(first.item));
		second.trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "touch" }));
		expect(first.element.open).toBe(true);
		expect(second.element.open).toBe(false);
		await userEvent.hover(second.trigger);
		await wait();
		expect(second.element.open).toBe(true);
		expect(document.activeElement).toBe(second.trigger);
		second.element.hide();
	});

	test("does not hover-switch to an aria-disabled menu trigger", async () => {
		const { first, second } = create();
		first.element.show();
		await vi.waitFor(() => expect(document.activeElement).toBe(first.item));
		first.trigger.focus();
		second.trigger.ariaDisabled = "true";
		await userEvent.hover(second.trigger);
		await wait();
		expect(first.element.open).toBe(true);
		expect(second.element.open).toBe(false);
		expect(document.activeElement).toBe(first.trigger);
		first.element.hide();
	});

	test("keeps aria-disabled commands focusable without activating them", async () => {
		const { element } = create();
		const command = document.createElement("button");
		command.role = "menuitem";
		command.ariaDisabled = "true";
		element.append(command);
		await wait();
		let clicks = 0;
		command.addEventListener("click", () => ++clicks);
		expect(element.items).toContain(command);
		expect(element.focusItem(command)).toBe(true);
		command.click();
		expect(clicks).toBe(0);
	});

	test("discovers late-upgraded and dynamically replaced direct menus", async () => {
		const barTag = `aui-menubar-late-${crypto.randomUUID()}`;
		const menuTag = `aui-menu-late-${crypto.randomUUID()}`;
		customElements.define(barTag, class extends MenubarElement {});
		const element = document.createElement(barTag) as MenubarElement;
		const child = document.createElement(menuTag);
		const trigger = document.createElement("button");
		trigger.slot = "trigger";
		const popup = document.createElement("div");
		popup.popover = "auto";
		child.append(trigger, popup);
		element.append(child);
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
		expect(trigger.hasAttribute("role")).toBe(false);
		child.remove();
		await wait();
		expect(replacement.hasAttribute("role")).toBe(false);
	});
});
