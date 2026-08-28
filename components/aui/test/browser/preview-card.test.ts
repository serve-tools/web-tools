import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { PreviewCardElement } from "../../src/preview-card-element.js";

const fixtures: Element[] = [];
const wait = (delay = 0) => new Promise<void>((resolve) => setTimeout(resolve, delay));

const parkTrustedPointer = async (): Promise<void> => {
	const target = document.createElement("div");
	target.style.cssText =
		"position:fixed;right:0;bottom:0;width:8px;height:8px;z-index:2147483647;pointer-events:auto";
	document.body.append(target);
	await userEvent.hover(target);
	target.remove();
};

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = (delay = 0, closeDelay = 20) => {
	const name = `aui-preview-card-${crypto.randomUUID()}`;
	customElements.define(name, class extends PreviewCardElement {});
	const element = document.createElement(name) as PreviewCardElement;
	element.delay = delay;
	element.closeDelay = closeDelay;
	const trigger = document.createElement("a");
	trigger.href = "#preview-target";
	const popup = document.createElement("article");
	popup.popover = "manual";
	element.append(trigger, popup);
	document.body.append(element);
	fixtures.push(element);
	return { element, popup, trigger };
};

const pointer = (
	target: Element,
	type: "pointerover" | "pointerout",
	pointerType: string,
	relatedTarget?: EventTarget,
) => {
	const event = new PointerEvent(type, { bubbles: true, pointerType, relatedTarget: relatedTarget ?? null });
	if (event.pointerType !== pointerType) {
		Object.defineProperty(event, "pointerType", { value: pointerType });
	}
	return target.dispatchEvent(event);
};

describe("PreviewCardElement", () => {
	test("uses an ordinary authored link and owns an auto popover", () => {
		const { element, popup, trigger } = create();
		expect(element.trigger).toBe(trigger);
		expect(element.popup).toBe(popup);
		expect(popup.popover).toBe("auto");
		expect(trigger.getAttribute("role")).toBeNull();
		expect(trigger.getAttribute("aria-haspopup")).toBeNull();

		let prevented: boolean | undefined;
		trigger.addEventListener("click", (event) => {
			prevented = event.defaultPrevented;
			event.preventDefault();
		});
		trigger.click();
		expect(prevented).toBe(false);
	});

	test("opens from hover with native source association and pointer grace across the popup", async () => {
		const { element, popup, trigger } = create(10, 20);
		let source: Element | null | undefined;
		element.addEventListener("beforetoggle", (event) => {
			if (event.newState === "open") {
				source = event.source;
			}
		});

		pointer(trigger, "pointerover", "mouse");
		await wait(15);
		expect(element.open).toBe(true);
		expect(source).toBe(trigger);

		pointer(trigger, "pointerout", "mouse", popup);
		pointer(popup, "pointerover", "mouse", trigger);
		await wait(30);
		expect(element.open).toBe(true);

		pointer(popup, "pointerout", "mouse");
		await wait(30);
		expect(element.open).toBe(false);
	});

	test("keeps focus occupancy open, does not move focus, and closes on Escape", async () => {
		const { element, popup, trigger } = create();
		const action = document.createElement("button");
		popup.append(action);
		trigger.focus();
		expect(element.open).toBe(true);
		expect(document.activeElement).toBe(trigger);

		action.focus();
		await wait(30);
		expect(element.open).toBe(true);
		expect(document.activeElement).toBe(action);

		await userEvent.keyboard("{Escape}");
		expect(element.open).toBe(false);
	});

	test("retains native auto-popover light dismissal", async () => {
		const { element } = create();
		const outside = document.createElement("button");
		element.after(outside);
		fixtures.push(outside);
		element.show();
		expect(element.open).toBe(true);

		await userEvent.click(outside);
		expect(element.open).toBe(false);
		await parkTrustedPointer();
	});

	test("restores replaced popup attributes and ignores stale timers after replacement", async () => {
		const { element, popup, trigger } = create(20);
		pointer(trigger, "pointerover", "mouse");
		const replacement = document.createElement("section");
		replacement.popover = "manual";
		popup.replaceWith(replacement);
		expect(element.trigger).toBe(trigger);
		expect(popup.popover).toBe("manual");
		expect(replacement.popover).toBe("auto");
		await wait(30);
		expect(replacement.matches(":popover-open")).toBe(false);
	});

	test("closes when its open source link is replaced", async () => {
		const { element, trigger } = create();
		element.show();
		expect(element.open).toBe(true);
		const replacement = document.createElement("a");
		replacement.href = "#replacement";
		replacement.slot = "trigger";
		trigger.replaceWith(replacement);

		expect(element.trigger).toBe(replacement);
		expect(element.open).toBe(false);
		await wait();
		expect(element.open).toBe(false);
	});

	test("does not retain its close guard when native toggle delivery coalesces around reopening", async () => {
		const { element, trigger } = create();
		element.show();
		element.hide();
		await Promise.resolve();
		element.show();
		await wait();
		expect(element.open).toBe(true);

		element.hide();
		await wait();
		trigger.focus();
		expect(element.open).toBe(true);
		element.hide();
	});

	test("ignores touch hover", async () => {
		const { element, trigger } = create();
		pointer(trigger, "pointerover", "touch");
		await wait();
		expect(element.open).toBe(false);
	});

	test("preserves an already-open native popup during late custom-element upgrade", () => {
		const name = `aui-preview-card-${crypto.randomUUID()}`;
		const element = document.createElement(name);
		const trigger = document.createElement("a");
		trigger.href = "#late-preview";
		const popup = document.createElement("article");
		popup.popover = "auto";
		element.append(trigger, popup);
		document.body.append(element);
		fixtures.push(element);
		popup.showPopover({ source: trigger });
		expect(popup.matches(":popover-open")).toBe(true);

		customElements.define(name, class extends PreviewCardElement {});
		expect((element as PreviewCardElement).trigger).toBe(trigger);
		expect((element as PreviewCardElement).open).toBe(true);
		(element as PreviewCardElement).hide();
	});
});
