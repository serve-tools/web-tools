import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { NavigationMenuElement } from "../../src/NavigationMenuElement.js";

const fixtures: Element[] = [];
const wait = (delay = 0) => new Promise<void>((resolve) => setTimeout(resolve, delay));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = () => {
	const name = `base-navigation-menu-${crypto.randomUUID()}`;
	customElements.define(name, class extends NavigationMenuElement {});
	const element = document.createElement(name) as NavigationMenuElement;
	const list = document.createElement("ul");
	list.slot = "list";
	const homeRow = document.createElement("li");
	const home = document.createElement("a");
	home.href = "#home";
	home.textContent = "Home";
	homeRow.append(home);
	const productsRow = document.createElement("li");
	const trigger = document.createElement("button");
	trigger.textContent = "Products";
	const popup = document.createElement("div");
	popup.popover = "auto";
	const link = document.createElement("a");
	link.href = "#product";
	link.textContent = "Product";
	popup.append(link);
	productsRow.append(trigger, popup);
	list.append(homeRow, productsRow);
	element.append(list);
	document.body.append(element);
	trigger.popoverTargetElement = popup;
	fixtures.push(element);
	return { element, home, link, list, popup, trigger };
};

describe("NavigationMenuElement", () => {
	test("retains native site-link and disclosure semantics without menu roles or roving tabindex", () => {
		const { element, home, link, list, trigger } = create();
		expect(element.list).toBe(list);
		expect(element.items).toEqual([home, trigger]);
		expect(element.disclosureTriggers).toEqual([trigger]);
		expect(home.hasAttribute("role")).toBe(false);
		expect(trigger.hasAttribute("role")).toBe(false);
		expect(link.hasAttribute("role")).toBe(false);
		expect([home.tabIndex, trigger.tabIndex]).toEqual([0, 0]);
	});

	test("uses authored native targets and keeps link activation native", async () => {
		const { element, link, popup, trigger } = create();
		expect(element.show(trigger)).toBe(true);
		expect(element.openTrigger).toBe(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		let defaultPrevented: boolean | undefined;
		link.addEventListener("click", (event) => {
			defaultPrevented = event.defaultPrevented;
			event.preventDefault();
		});
		await userEvent.click(link);
		expect(defaultPrevented).toBe(false);
		expect(popup.matches(":popover-open")).toBe(true);
		element.hide();
	});

	test("moves top-level focus with arrows without changing Tab order", async () => {
		const { home, trigger } = create();
		home.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(trigger);
		expect([home.tabIndex, trigger.tabIndex]).toEqual([0, 0]);
		await userEvent.keyboard("{ArrowDown}");
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
	});

	test("skips native-disabled top-level items in LTR and RTL", async () => {
		const { element, home, list, trigger } = create();
		trigger.disabled = true;
		const hiddenRow = document.createElement("li");
		const hidden = document.createElement("a");
		hidden.href = "#hidden";
		hidden.hidden = true;
		hiddenRow.append(hidden);
		const row = document.createElement("li");
		const later = document.createElement("a");
		later.href = "#later";
		row.append(later);
		list.append(hiddenRow, row);
		await wait();
		home.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(later);
		element.dir = "rtl";
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(home);
	});

	test("honors canceled native opening and native Escape", async () => {
		const { element, trigger } = create();
		const popup = element.disclosureTriggers.length ? trigger.popoverTargetElement : null;
		popup?.addEventListener("beforetoggle", (event) => event.preventDefault(), { once: true });
		expect(element.show(trigger)).toBe(false);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(element.show(trigger)).toBe(true);
		await userEvent.keyboard("{Escape}");
		expect(element.openTrigger).toBeNull();
	});

	test("prevents native invocation from an aria-disabled disclosure trigger", () => {
		const { element, trigger } = create();
		trigger.ariaDisabled = "true";
		trigger.click();
		expect(element.openTrigger).toBeNull();
		expect(element.show(trigger)).toBe(false);
	});

	test("ignores disclosure targets that are not native auto popovers", async () => {
		const { element, popup, trigger } = create();
		popup.popover = "manual";
		await wait();
		expect(element.disclosureTriggers).toEqual([]);
		expect(element.show(trigger)).toBe(false);
	});

	test("opens and closes hover disclosures with bounded delay", async () => {
		const { element, popup, trigger } = create();
		const outside = document.createElement("button");
		outside.textContent = "Outside";
		outside.style.cssText = "position:fixed;right:0;bottom:0";
		document.body.append(outside);
		fixtures.push(outside);
		element.delay = 5;
		element.closeDelay = 0;
		await userEvent.hover(trigger);
		await wait(10);
		expect(popup.matches(":popover-open")).toBe(true);
		await userEvent.hover(outside);
		await wait();
		expect(popup.matches(":popover-open")).toBe(false);
	});

	test("cancels delayed hover opening after leaving or returning to an open disclosure", async () => {
		const { element, popup, trigger } = create();
		const outside = document.createElement("button");
		document.body.append(outside);
		fixtures.push(outside);
		element.delay = 100;
		element.closeDelay = 0;
		trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
		trigger.dispatchEvent(
			new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: outside }),
		);
		await wait(120);
		expect(popup.matches(":popover-open")).toBe(false);

		const secondRow = document.createElement("li");
		const secondTrigger = document.createElement("button");
		const secondPopup = document.createElement("div");
		secondPopup.popover = "auto";
		secondRow.append(secondTrigger, secondPopup);
		element.list?.append(secondRow);
		secondTrigger.popoverTargetElement = secondPopup;
		await wait();
		element.show(trigger);
		secondTrigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
		trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
		await wait(120);
		expect(popup.matches(":popover-open")).toBe(true);
		expect(secondPopup.matches(":popover-open")).toBe(false);
		element.hide();
	});

	test("keeps top-level items when the whole navigation is inside an outer popover", () => {
		const { element, home, trigger } = create();
		const outer = document.createElement("div");
		outer.popover = "auto";
		element.replaceWith(outer);
		outer.append(element);
		fixtures.push(outer);
		expect(element.items).toEqual([home, trigger]);
	});

	test("updates relationships after dynamic target replacement and adoption", async () => {
		const { element, popup, trigger } = create();
		element.show(trigger);
		element.closeDelay = 80;
		trigger.dispatchEvent(
			new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body, pointerType: "mouse" }),
		);
		const replacement = document.createElement("div");
		replacement.popover = "auto";
		replacement.id = crypto.randomUUID();
		element.querySelector("li:last-child")?.append(replacement);
		trigger.popoverTargetElement = replacement;
		await wait();
		expect(popup.matches(":popover-open")).toBe(false);
		expect(element.show(trigger)).toBe(true);
		await wait(100);
		expect(replacement.matches(":popover-open")).toBe(true);
		element.hide();
		popup.remove();

		const frame = document.createElement("iframe");
		document.body.append(frame);
		fixtures.push(frame);
		const frameDocument = frame.contentDocument;
		if (!frameDocument) {
			throw new Error("Same-origin frame unavailable");
		}
		element.delay = 50;
		trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
		frameDocument.body.append(frameDocument.adoptNode(element));
		await wait(80);
		expect(element.disclosureTriggers).toEqual([trigger]);
		expect(element.openTrigger).toBeNull();
	});

	test("preserves an already-open native disclosure during late upgrade", () => {
		const name = `base-navigation-menu-late-${crypto.randomUUID()}`;
		const element = document.createElement(name);
		const list = document.createElement("ul");
		list.slot = "list";
		const row = document.createElement("li");
		const trigger = document.createElement("button");
		const popup = document.createElement("div");
		popup.popover = "auto";
		row.append(trigger, popup);
		list.append(row);
		element.append(list);
		document.body.append(element);
		fixtures.push(element);
		trigger.popoverTargetElement = popup;
		popup.showPopover({ source: trigger });
		customElements.define(name, class extends NavigationMenuElement {});

		expect((element as NavigationMenuElement).openTrigger).toBe(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(element.matches(":state(open)")).toBe(true);
		(element as NavigationMenuElement).hide();
	});
});
