import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ContextMenuElement } from "../../src/ContextMenuElement.js";

const fixtures: Element[] = [];
const wait = (delay = 0) => new Promise<void>((resolve) => setTimeout(resolve, delay));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = () => {
	const name = `base-context-menu-${crypto.randomUUID()}`;
	customElements.define(name, class extends ContextMenuElement {});
	const element = document.createElement(name) as ContextMenuElement;
	const trigger = document.createElement("section");
	trigger.slot = "trigger";
	trigger.tabIndex = 0;
	const popup = document.createElement("div");
	popup.popover = "auto";
	const item = document.createElement("button");
	item.role = "menuitem";
	item.textContent = "Inspect";
	popup.append(item);
	element.append(trigger, popup);
	document.body.append(element);
	fixtures.push(element);
	return { element, item, popup, trigger };
};

describe("ContextMenuElement", () => {
	test("opens at pointer coordinates and prevents the browser menu only on success", async () => {
		const { element, item, popup, trigger } = create();
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
		expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 32, clientY: 48 });
		expect(trigger.dispatchEvent(event)).toBe(false);
		await wait();
		expect(element.open).toBe(true);
		expect(popup.style.getPropertyValue("--base-context-menu-x")).toBe("32px");
		expect(popup.style.getPropertyValue("--base-context-menu-y")).toBe("48px");
		expect(document.activeElement).toBe(item);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		element.hide();
	});

	test("honors a contextmenu event canceled by authored trigger content", () => {
		const { element, trigger } = create();
		trigger.addEventListener("contextmenu", (event) => event.preventDefault());
		const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 3, clientY: 4 });
		expect(trigger.dispatchEvent(event)).toBe(false);
		expect(element.open).toBe(false);
	});

	test("canceled opening leaves the native context menu event uncanceled", () => {
		const { element, trigger } = create();
		element.addEventListener("beforetoggle", (event) => event.preventDefault(), { once: true });
		const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 1, clientY: 2 });
		expect(trigger.dispatchEvent(event)).toBe(true);
		expect(element.open).toBe(false);
	});

	test("supports keyboard context-menu invocation and native Escape", async () => {
		const { element, trigger } = create();
		trigger.focus();
		await userEvent.keyboard("{Shift>}{F10}{/Shift}");
		await wait();
		expect(element.open).toBe(true);
		await userEvent.keyboard("{Escape}");
		expect(element.open).toBe(false);
	});

	test("implements the synthetic touch long-press branch and movement cancellation", async () => {
		const { element, trigger } = create();
		const pointer = (type: string, x: number, isPrimary = true, pointerId = 7) =>
			trigger.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					cancelable: true,
					clientX: x,
					clientY: 4,
					isPrimary,
					pointerId,
					pointerType: "touch",
				}),
			);
		pointer("pointerdown", 4);
		pointer("pointermove", 20);
		await wait(520);
		expect(element.open).toBe(false);
		pointer("pointerdown", 4);
		pointer("pointerdown", 4, false, 8);
		await wait(520);
		expect(element.open).toBe(false);
		trigger.addEventListener("pointerdown", (event) => event.preventDefault(), { once: true });
		pointer("pointerdown", 4);
		await wait(520);
		expect(element.open).toBe(false);
		pointer("pointerdown", 4);
		await wait(520);
		expect(element.open).toBe(true);
		element.hide();
	});

	test("invalidates a pending synthetic long press after context-area replacement", async () => {
		const { element, trigger } = create();
		trigger.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				clientX: 4,
				clientY: 4,
				isPrimary: true,
				pointerId: 8,
				pointerType: "touch",
			}),
		);
		const replacement = document.createElement("section");
		replacement.slot = "trigger";
		trigger.replaceWith(replacement);
		await wait(520);
		expect(element.open).toBe(false);
		expect(element.trigger).toBe(replacement);
	});

	test("invalidates a pending synthetic long press after popup replacement or removal", async () => {
		for (const replace of [true, false]) {
			const { element, popup, trigger } = create();
			trigger.dispatchEvent(
				new PointerEvent("pointerdown", {
					bubbles: true,
					isPrimary: true,
					pointerId: 9,
					pointerType: "touch",
				}),
			);
			if (replace) {
				const replacement = document.createElement("div");
				replacement.popover = "auto";
				popup.replaceWith(replacement);
			} else {
				popup.remove();
			}
			await wait(520);
			expect(element.open).toBe(false);
		}
	});

	test("closes on context-area replacement", () => {
		const { element, trigger } = create();
		element.showAt(1, 2);
		const replacement = document.createElement("article");
		replacement.slot = "trigger";
		trigger.replaceWith(replacement);
		expect(element.trigger).toBe(replacement);
		expect(element.open).toBe(false);
		expect(trigger.hasAttribute("aria-haspopup")).toBe(false);
		expect(replacement.getAttribute("aria-haspopup")).toBe("menu");
	});

	test("preserves initial native open state and reacquires interaction after adoption", async () => {
		const name = `base-context-menu-late-${crypto.randomUUID()}`;
		const element = document.createElement(name);
		const trigger = document.createElement("section");
		trigger.slot = "trigger";
		const popup = document.createElement("div");
		popup.popover = "auto";
		const item = document.createElement("button");
		item.role = "menuitem";
		popup.append(item);
		element.append(trigger, popup);
		document.body.append(element);
		fixtures.push(element);
		popup.showPopover({ source: trigger });
		customElements.define(name, class extends ContextMenuElement {});
		expect((element as ContextMenuElement).open).toBe(true);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		(element as ContextMenuElement).hide();

		const frame = document.createElement("iframe");
		document.body.append(frame);
		fixtures.push(frame);
		const frameDocument = frame.contentDocument;
		const frameWindow = frame.contentWindow;
		if (!frameDocument || !frameWindow) {
			throw new Error("Same-origin frame unavailable");
		}
		trigger.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				clientX: 6,
				clientY: 8,
				isPrimary: true,
				pointerId: 9,
				pointerType: "touch",
			}),
		);
		frameDocument.body.append(frameDocument.adoptNode(element));
		await wait(520);
		expect((element as ContextMenuElement).open).toBe(false);
		const event = new (frameWindow as typeof window).MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			clientX: 12,
			clientY: 24,
		});
		expect(trigger.dispatchEvent(event)).toBe(false);
		expect((element as ContextMenuElement).open).toBe(true);
		expect(popup.style.getPropertyValue("--base-context-menu-x")).toBe("12px");
		(element as ContextMenuElement).hide();
		element.remove();
		expect(trigger.hasAttribute("aria-haspopup")).toBe(false);
		expect(trigger.hasAttribute("aria-controls")).toBe(false);
		expect(trigger.hasAttribute("aria-expanded")).toBe(false);
	});
});
