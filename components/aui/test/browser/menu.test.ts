import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { MenuElement } from "../../src/menu-element.js";

const fixtures: Element[] = [];
const wait = (delay = 0) => new Promise<void>((resolve) => setTimeout(resolve, delay));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = () => {
	const name = `aui-menu-${crypto.randomUUID()}`;
	customElements.define(name, class extends MenuElement {});
	const element = document.createElement(name) as MenuElement;
	const trigger = document.createElement("button");
	trigger.slot = "trigger";
	trigger.textContent = "File";
	const popup = document.createElement("div");
	popup.popover = "auto";
	const action = document.createElement("button");
	action.role = "menuitem";
	action.textContent = "New";
	const check = document.createElement("button");
	check.role = "menuitemcheckbox";
	check.ariaChecked = "false";
	check.textContent = "Grid";
	const disabled = document.createElement("button");
	disabled.role = "menuitem";
	disabled.disabled = true;
	disabled.textContent = "Unavailable";
	const link = document.createElement("a");
	link.role = "menuitem";
	link.href = "#menu-link";
	link.textContent = "Open";
	popup.append(action, check, disabled, link);
	element.append(trigger, popup);
	document.body.append(element);
	trigger.popoverTargetElement = popup;
	fixtures.push(element);
	return { action, check, disabled, element, link, popup, trigger };
};

describe("MenuElement", () => {
	test("uses native invoker state and focuses the first item on opening", async () => {
		const { action, element, popup, trigger } = create();
		expect(element.trigger).toBe(trigger);
		expect(element.items).toHaveLength(4);
		expect(popup.role).toBe("menu");
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");

		await userEvent.click(trigger);
		await vi.waitFor(() => expect(document.activeElement).toBe(action));
		expect(element.open).toBe(true);
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		element.hide();
	});

	test("preserves external native invokers and their source association", async () => {
		const { action, element, popup } = create();
		const external = document.createElement("button");
		external.textContent = "Open commands";
		document.body.append(external);
		fixtures.push(external);
		external.popoverTargetElement = popup;
		let source: Element | null = null;
		element.addEventListener("beforetoggle", (event) => {
			if (event.newState === "open") {
				source = event.source;
			}
		});

		await userEvent.click(external);
		await vi.waitFor(() => expect(document.activeElement).toBe(action));
		expect(element.open).toBe(true);
		expect(source).toBe(external);
		element.hide();
	});

	test("supports arrows, Home, End, disabled skipping, and typeahead", async () => {
		const { action, check, element, link } = create();
		element.show();
		await vi.waitFor(() => expect(document.activeElement).toBe(action));
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(check);
		await userEvent.keyboard("{End}");
		expect(document.activeElement).toBe(link);
		await userEvent.keyboard("n");
		expect(document.activeElement).toBe(action);
		element.hide();
	});

	test("commits checkboxes and radio peers without creating form entries", async () => {
		const { check, element, popup } = create();
		const group = document.createElement("div");
		group.role = "group";
		const light = document.createElement("button");
		light.role = "menuitemradio";
		light.ariaChecked = "true";
		light.value = "light";
		const dark = document.createElement("button");
		dark.role = "menuitemradio";
		dark.ariaChecked = "false";
		dark.value = "dark";
		group.append(light, dark);
		popup.append(group);
		await wait();
		const events: string[] = [];
		element.addEventListener("beforechange", (event) =>
			events.push(`${event.detail.item.textContent}:${event.detail.checked}`),
		);
		element.addEventListener("input", () => events.push("input"));
		element.addEventListener("change", () => events.push("change"));

		check.click();
		expect(check.ariaChecked).toBe("true");
		dark.click();
		expect(light.ariaChecked).toBe("false");
		expect(dark.ariaChecked).toBe("true");
		expect(check.type).toBe("button");
		expect(new FormData(document.createElement("form")).has("light")).toBe(false);
		expect(events).toEqual(["Grid:true", "input", "change", ":true", "input", "change"]);
	});

	test("commits a pointer checkbox click immediately after native opening", async () => {
		const { check, element, trigger } = create();
		await userEvent.click(trigger);
		await userEvent.click(check);
		expect(check.ariaChecked).toBe("true");
		expect(element.open).toBe(true);
		element.hide();
	});

	test("keeps rapid trusted menu actions targetable after scrolling a long document", async () => {
		const spacer = document.createElement("div");
		spacer.style.height = "12000px";
		document.body.prepend(spacer);
		fixtures.push(spacer);
		const { action, check, element, popup, trigger } = create();
		popup.style.cssText =
			"position:fixed;position-area:block-end;position-try-fallbacks:flip-block,flip-inline;inset:auto";
		let changes = 0;
		let actions = 0;
		element.addEventListener("change", () => ++changes);
		action.addEventListener("click", () => ++actions);
		await userEvent.click(trigger);
		await userEvent.click(check);
		expect(check.ariaChecked).toBe("true");
		expect(changes).toBe(1);
		await userEvent.click(action);
		expect(actions).toBe(1);
		expect(element.open).toBe(false);
	});

	test("cancellation and stale or reentrant proposals do not commit", () => {
		const { check, element } = create();
		const cancel = (event: CustomEvent) => event.preventDefault();
		element.addEventListener("beforechange", cancel as EventListener, { once: true });
		check.click();
		expect(check.ariaChecked).toBe("false");

		element.addEventListener(
			"beforechange",
			() => {
				check.setAttribute("aria-disabled", "true");
				check.click();
			},
			{ once: true },
		);
		check.click();
		expect(check.ariaChecked).toBe("false");
	});

	test("stops stale post-commit events and close work after input or change mutation", () => {
		const inputCase = create();
		inputCase.check.dataset.closeOnClick = "true";
		inputCase.element.show();
		let inputChanges = 0;
		inputCase.element.addEventListener("input", () => inputCase.element.setChecked(inputCase.check, false), {
			once: true,
		});
		inputCase.element.addEventListener("change", () => ++inputChanges);
		inputCase.check.click();
		expect(inputCase.check.ariaChecked).toBe("false");
		expect(inputChanges).toBe(0);
		expect(inputCase.element.open).toBe(true);
		inputCase.element.hide();

		const changeCase = create();
		changeCase.check.dataset.closeOnClick = "true";
		changeCase.element.show();
		changeCase.element.addEventListener(
			"change",
			() => changeCase.check.setAttribute("data-close-on-click", "false"),
			{ once: true },
		);
		changeCase.check.click();
		expect(changeCase.check.ariaChecked).toBe("true");
		expect(changeCase.element.open).toBe(true);
		changeCase.element.hide();
	});

	test("does not dispatch stale change or close a replacement opened by an input listener", async () => {
		const { check, element } = create();
		check.dataset.closeOnClick = "true";
		element.show();
		const replacement = document.createElement("div");
		replacement.popover = "auto";
		const replacementItem = document.createElement("button");
		replacementItem.role = "menuitem";
		replacement.append(replacementItem);
		let changes = 0;
		element.addEventListener(
			"input",
			() => {
				element.prepend(replacement);
				element.show();
			},
			{ once: true },
		);
		element.addEventListener("change", () => ++changes);
		check.click();
		await wait();
		expect(changes).toBe(0);
		expect(element.popup).toBe(replacement);
		expect(replacement.matches(":popover-open")).toBe(true);
		element.hide();
	});

	test("aborts a radio proposal when a listener changes its exclusivity group", async () => {
		const { element, popup } = create();
		const group = document.createElement("div");
		group.role = "group";
		const first = document.createElement("button");
		first.role = "menuitemradio";
		first.ariaChecked = "true";
		const second = document.createElement("button");
		second.role = "menuitemradio";
		second.ariaChecked = "false";
		group.append(first, second);
		popup.append(group);
		await wait();
		let changes = 0;
		element.addEventListener("beforechange", () => {
			group.role = "none";
		});
		element.addEventListener("input", () => ++changes);
		element.addEventListener("change", () => ++changes);

		second.click();
		expect(first.ariaChecked).toBe("true");
		expect(second.ariaChecked).toBe("false");
		expect(changes).toBe(0);
	});

	test("recognizes only exact close override strings", async () => {
		const { check, element } = create();
		element.show();
		await wait();
		check.setAttribute("data-close-on-click", "yes");
		check.click();
		expect(check.ariaChecked).toBe("true");
		expect(element.open).toBe(true);
		check.setAttribute("data-close-on-click", "true");
		check.click();
		expect(element.open).toBe(false);
	});

	test("honors canceled native opening and noncancelable native closing", async () => {
		const { element, popup, trigger } = create();
		const cancel = (event: ToggleEvent) => {
			if (event.newState === "open") {
				event.preventDefault();
			}
		};
		element.addEventListener("beforetoggle", cancel, { once: true });
		await userEvent.click(trigger);
		await wait();
		expect(element.open).toBe(false);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");

		element.show();
		element.addEventListener("beforetoggle", (event) => {
			if (event.newState === "closed") {
				expect(event.cancelable).toBe(false);
				event.preventDefault();
			}
		});
		element.hide();
		expect(popup.matches(":popover-open")).toBe(false);
	});

	test("cancels an opening when its forwarded listener replaces the selected popup", async () => {
		const { element, popup } = create();
		const replacement = document.createElement("div");
		replacement.popover = "auto";
		const replacementItem = document.createElement("button");
		replacementItem.role = "menuitem";
		replacement.append(replacementItem);
		element.addEventListener(
			"beforetoggle",
			(event) => {
				if (event.newState === "open") {
					element.prepend(replacement);
				}
			},
			{ once: true },
		);

		element.show();
		await wait();
		expect(popup.matches(":popover-open")).toBe(false);
		expect(element.popup).toBe(replacement);
		expect(element.open).toBe(false);
		const external = document.createElement("button");
		document.body.append(external);
		fixtures.push(external);
		external.popoverTargetElement = replacement;
		external.click();
		await vi.waitFor(() => expect(document.activeElement).toBe(replacementItem));
		expect(element.open).toBe(true);
		element.hide();
	});

	test("clears typeahead state when the selected popup changes", async () => {
		const { action, element, popup } = create();
		element.show();
		await wait();
		action.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "n" }));
		const replacement = document.createElement("div");
		replacement.popover = "auto";
		const beta = document.createElement("button");
		beta.role = "menuitem";
		beta.textContent = "Beta";
		const gamma = document.createElement("button");
		gamma.role = "menuitem";
		gamma.textContent = "Gamma";
		replacement.append(beta, gamma);
		popup.replaceWith(replacement);
		element.trigger;
		element.show();
		await vi.waitFor(() => expect(document.activeElement).toBe(beta));
		await userEvent.keyboard("g");
		expect(document.activeElement).toBe(gamma);
		element.hide();
	});

	test("skips stale opening and closing toggle work after listener replacement", async () => {
		const opening = create();
		const openingReplacement = document.createElement("div");
		openingReplacement.popover = "auto";
		const replacementItem = document.createElement("button");
		replacementItem.role = "menuitem";
		openingReplacement.append(replacementItem);
		opening.element.addEventListener(
			"toggle",
			(event) => {
				if (event.newState === "open") {
					opening.element.prepend(openingReplacement);
				}
			},
			{ once: true },
		);
		opening.element.show();
		await wait();
		expect(opening.element.popup).toBe(openingReplacement);
		expect(opening.popup.matches(":popover-open")).toBe(false);
		expect(document.activeElement).not.toBe(replacementItem);

		const closing = create();
		closing.element.show();
		await wait();
		const closingReplacement = document.createElement("div");
		closingReplacement.popover = "auto";
		closing.element.addEventListener(
			"toggle",
			(event) => {
				if (event.newState === "closed") {
					closing.element.prepend(closingReplacement);
				}
			},
			{ once: true },
		);
		closing.element.hide();
		await wait();
		expect(closing.element.popup).toBe(closingReplacement);
		expect(closingReplacement.matches(":popover-open")).toBe(false);
		expect(closing.element.open).toBe(false);
	});

	test("prevents native invocation from an aria-disabled primary trigger", async () => {
		const { element, trigger } = create();
		trigger.ariaDisabled = "true";
		trigger.click();
		expect(element.open).toBe(false);
		trigger.focus();
		await userEvent.keyboard("{ArrowDown}");
		expect(element.open).toBe(false);
	});

	test("activates link menu items with Space and suppresses disabled link activation", async () => {
		const { element, link } = create();
		let clicks = 0;
		link.addEventListener("click", (event) => {
			++clicks;
			event.preventDefault();
		});
		element.show();
		await wait();
		element.focusItem(link);
		await userEvent.keyboard(" ");
		expect(clicks).toBe(1);
		link.ariaDisabled = "true";
		await userEvent.keyboard(" ");
		expect(clicks).toBe(1);
		element.hide();
	});

	test("handles navigation keys with one item and skips hidden items", async () => {
		const { action, check, disabled, element, link, popup } = create();
		action.hidden = true;
		await wait();
		expect(action.tabIndex).toBe(-1);
		expect(check.tabIndex).toBe(0);
		disabled.remove();
		element.show();
		await vi.waitFor(() => expect(document.activeElement).toBe(check));
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(link);
		check.remove();
		action.remove();
		await wait();
		for (const key of ["ArrowDown", "Home", "End"]) {
			const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key });
			link.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
		}
		element.hide();
		expect(popup.matches(":popover-open")).toBe(false);
	});

	test("scans both requested focus edges past unavailable items", async () => {
		const { action, check, disabled, element, link, trigger } = create();
		action.hidden = true;
		link.hidden = true;
		trigger.focus();
		await userEvent.keyboard("{ArrowDown}");
		await vi.waitFor(() => expect(document.activeElement).toBe(check));
		element.hide();
		trigger.focus();
		await userEvent.keyboard("{ArrowUp}");
		await vi.waitFor(() => expect(document.activeElement).toBe(check));
		expect(disabled.disabled).toBe(true);
		element.hide();
	});

	test("does not hover-open from a disabled primary trigger", async () => {
		const { element, trigger } = create();
		element.openOnHover = true;
		element.delay = 0;
		trigger.ariaDisabled = "true";
		trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
		await wait();
		expect(element.open).toBe(false);
		trigger.ariaDisabled = null;
		element.delay = 20;
		trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
		trigger.disabled = true;
		await wait(30);
		expect(element.open).toBe(false);
	});

	test("owns horizontal orientation on the popup and restores authored values", () => {
		const { element, popup } = create();
		popup.ariaOrientation = "horizontal";
		element.trigger;
		expect(popup.ariaOrientation).toBe("vertical");
		element.orientation = "horizontal";
		expect(popup.ariaOrientation).toBe("horizontal");
		element.orientation = "vertical";
		expect(popup.ariaOrientation).toBe("vertical");
		element.orientation = "horizontal";
		const replacement = document.createElement("div");
		replacement.popover = "auto";
		popup.replaceWith(replacement);
		element.trigger;
		expect(element.popup).toBe(replacement);
		expect(popup.ariaOrientation).toBe("horizontal");
		expect(replacement.ariaOrientation).toBe("horizontal");
	});

	test("uses RTL-aware axis keys and block-end submenu entry in a horizontal menu", async () => {
		const { action, check, element } = create();
		element.orientation = "horizontal";
		element.show();
		await vi.waitFor(() => expect(document.activeElement).toBe(action));
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(check);
		element.style.direction = "rtl";
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(action);
		element.hide();
	});

	test("keeps nested menu collections independent and uses RTL-aware submenu arrows", async () => {
		const { action, element, popup } = create();
		const name = `aui-submenu-${crypto.randomUUID()}`;
		customElements.define(name, class extends MenuElement {});
		const submenu = document.createElement(name) as MenuElement;
		const submenuTrigger = document.createElement("button");
		submenuTrigger.slot = "trigger";
		submenuTrigger.role = "menuitem";
		submenuTrigger.textContent = "Share";
		const submenuPopup = document.createElement("div");
		submenuPopup.popover = "auto";
		const submenuItem = document.createElement("button");
		submenuItem.role = "menuitem";
		submenuItem.textContent = "Copy link";
		submenuPopup.append(submenuItem);
		submenu.append(submenuTrigger, submenuPopup);
		popup.append(submenu);
		submenuTrigger.popoverTargetElement = submenuPopup;
		await wait();

		expect(element.items).toContain(submenuTrigger);
		expect(element.items).not.toContain(submenuItem);
		expect(submenu.items).toEqual([submenuItem]);
		element.show();
		await vi.waitFor(() => expect(document.activeElement).toBe(action));
		element.focusItem(submenuTrigger);
		await userEvent.keyboard("{ArrowRight}");
		await vi.waitFor(() => expect(document.activeElement).toBe(submenuItem));
		expect(submenu.open).toBe(true);
		await userEvent.keyboard("{ArrowLeft}");
		expect(submenu.open).toBe(false);
		expect(document.activeElement).toBe(submenuTrigger);

		element.style.direction = "rtl";
		await userEvent.keyboard("{ArrowLeft}");
		await vi.waitFor(() => expect(document.activeElement).toBe(submenuItem));
		expect(submenu.open).toBe(true);
		await userEvent.keyboard("{ArrowRight}");
		expect(submenu.open).toBe(false);
		expect(document.activeElement).toBe(submenuTrigger);

		element.style.direction = "ltr";
		submenu.openOnHover = true;
		submenu.delay = 0;
		submenuTrigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
		await wait();
		expect(submenu.open).toBe(true);
		submenuTrigger.focus();
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(submenuItem);
		submenu.hide();
		element.hide();
	});

	test("retains submenu occupancy during pointer grace and closes after leaving its corridor", async () => {
		const { popup } = create();
		const name = `aui-hover-submenu-${crypto.randomUUID()}`;
		customElements.define(name, class extends MenuElement {});
		const submenu = document.createElement(name) as MenuElement;
		submenu.openOnHover = true;
		submenu.delay = 0;
		const trigger = document.createElement("button");
		trigger.slot = "trigger";
		trigger.role = "menuitem";
		const submenuPopup = document.createElement("div");
		submenuPopup.popover = "auto";
		const item = document.createElement("button");
		item.role = "menuitem";
		submenuPopup.append(item);
		submenu.append(trigger, submenuPopup);
		popup.append(submenu);
		trigger.popoverTargetElement = submenuPopup;
		vi.spyOn(submenuPopup, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 0, 100, 100));

		submenu.show();
		await wait();
		expect(submenu.open).toBe(true);
		trigger.dispatchEvent(
			new PointerEvent("pointerout", { bubbles: true, clientX: 50, clientY: 50, pointerType: "mouse" }),
		);
		document.dispatchEvent(
			new PointerEvent("pointermove", { bubbles: true, clientX: 80, clientY: 50, pointerType: "mouse" }),
		);
		await wait(100);
		expect(submenu.open).toBe(true);
		document.dispatchEvent(
			new PointerEvent("pointermove", { bubbles: true, clientX: 0, clientY: 200, pointerType: "mouse" }),
		);
		await wait();
		expect(submenu.open).toBe(false);
	});

	test("invalidates pointer grace before a replacement popup can open", async () => {
		const { element, popup, trigger } = create();
		vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 0, 100, 100));
		element.show();
		await wait();
		trigger.dispatchEvent(
			new PointerEvent("pointerout", { bubbles: true, clientX: 50, clientY: 50, pointerType: "mouse" }),
		);
		const replacement = document.createElement("div");
		replacement.popover = "auto";
		const item = document.createElement("button");
		item.role = "menuitem";
		replacement.append(item);
		popup.replaceWith(replacement);
		element.trigger;
		element.show();
		document.dispatchEvent(
			new PointerEvent("pointermove", { bubbles: true, clientX: 0, clientY: 200, pointerType: "mouse" }),
		);
		await wait();
		expect(element.open).toBe(true);
		element.hide();
	});

	test("restores replacements and preserves already-open late-upgrade state", async () => {
		const { action, element, popup, trigger } = create();
		const replacementItem = document.createElement("button");
		replacementItem.role = "menuitem";
		action.replaceWith(replacementItem);
		expect(element.items[0]).toBe(replacementItem);
		expect(action.hasAttribute("tabindex")).toBe(false);
		element.show();
		await wait();
		const replacement = document.createElement("button");
		replacement.slot = "trigger";
		trigger.replaceWith(replacement);
		await wait();
		expect(element.open).toBe(false);
		expect(trigger.hasAttribute("aria-haspopup")).toBe(false);

		const name = `aui-menu-late-${crypto.randomUUID()}`;
		const late = document.createElement(name);
		const lateTrigger = document.createElement("button");
		lateTrigger.slot = "trigger";
		const latePopup = document.createElement("div");
		latePopup.setAttribute("popover", "");
		latePopup.role = "menu";
		late.append(lateTrigger, latePopup);
		document.body.append(late);
		fixtures.push(late);
		latePopup.showPopover({ source: lateTrigger });
		customElements.define(name, class extends MenuElement {});
		expect((late as MenuElement).open).toBe(true);
		expect(latePopup.getAttribute("popover")).toBe("");
		(late as MenuElement).hide();
		replacement.setAttribute("aria-controls", "authored-panel");
		popup.remove();
		expect(element.trigger).toBe(replacement);
		expect(replacement.getAttribute("aria-controls")).toBe("authored-panel");
		expect(replacement.hasAttribute("aria-haspopup")).toBe(false);
		expect(popup.hasAttribute("role")).toBe(false);
		expect(popup.hasAttribute("id")).toBe(false);
	});

	test("restores ownership while disconnected and reacquires owner-realm behavior after adoption", async () => {
		const { action, element, popup, trigger } = create();
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
		expect(popup.role).toBe("menu");
		expect(action.tabIndex).toBe(0);
		element.remove();
		expect(trigger.hasAttribute("aria-haspopup")).toBe(false);
		expect(popup.hasAttribute("role")).toBe(false);
		expect(action.hasAttribute("tabindex")).toBe(false);
		document.body.append(element);
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
		expect(popup.role).toBe("menu");

		const frame = document.createElement("iframe");
		document.body.append(frame);
		fixtures.push(frame);
		const frameDocument = frame.contentDocument;
		const frameWindow = frame.contentWindow;
		if (!frameDocument || !frameWindow) {
			throw new Error("Same-origin frame unavailable");
		}
		element.openOnHover = true;
		element.delay = 50;
		const setTimeoutSpy = vi.spyOn(window, "setTimeout");
		const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
		trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
		const timer = setTimeoutSpy.mock.results.at(-1)?.value;
		if (typeof timer !== "number") {
			throw new Error("Owner-realm hover timer unavailable");
		}
		frameDocument.body.append(frameDocument.adoptNode(element));
		expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
		element.show();
		await vi.waitFor(() => expect(frameDocument.activeElement).toBe(action));
		expect(element.ownerDocument).toBe(frameDocument);
		const event = new (frameWindow as typeof window).KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "ArrowDown",
		});
		action.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(frameDocument.activeElement).toBe(element.items[1]);
		element.hide();
	});

	test("lets Tab close the menu without retaining focus inside it", async () => {
		const { action, element } = create();
		const outside = document.createElement("button");
		outside.textContent = "After menu";
		document.body.append(outside);
		fixtures.push(outside);
		element.show();
		await vi.waitFor(() => expect(document.activeElement).toBe(action));
		await userEvent.keyboard("{Tab}");
		expect(element.open).toBe(false);
		expect(element.contains(document.activeElement)).toBe(false);
		expect(outside.isConnected).toBe(true);
	});
});
