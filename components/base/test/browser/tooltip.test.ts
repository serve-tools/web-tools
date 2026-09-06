import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { TooltipElement } from "../../src/TooltipElement.js";

const fixtures: Element[] = [];
const wait = (delay = 0) => new Promise<void>((resolve) => setTimeout(resolve, delay));

beforeEach(async () => {
	const pointerTarget = document.createElement("div");
	pointerTarget.style.cssText =
		"position:fixed;right:0;bottom:0;width:8px;height:8px;z-index:2147483647;pointer-events:auto";
	document.body.append(pointerTarget);
	fixtures.push(pointerTarget);
	await userEvent.hover(pointerTarget);
});

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = (delay = 0, closeDelay = 0) => {
	const name = `base-tooltip-${crypto.randomUUID()}`;
	customElements.define(name, class extends TooltipElement {});
	const element = document.createElement(name) as TooltipElement;
	element.delay = delay;
	element.closeDelay = closeDelay;
	const trigger = document.createElement("button");
	trigger.setAttribute("aria-describedby", "authored");
	const popup = document.createElement("div");
	popup.popover = "auto";
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
	const PointerEventConstructor = target.ownerDocument.defaultView?.PointerEvent ?? PointerEvent;
	const event = new PointerEventConstructor(type, {
		bubbles: true,
		pointerType,
		relatedTarget: relatedTarget ?? null,
	});
	if (event.pointerType !== pointerType) {
		Object.defineProperty(event, "pointerType", { value: pointerType });
	}
	return target.dispatchEvent(event);
};

const adoptIntoFreshFrame = (element: TooltipElement): Document => {
	const frame = document.createElement("iframe");
	document.body.append(frame);
	fixtures.push(frame);
	const frameDocument = frame.contentDocument;
	if (!frameDocument) {
		throw new Error("Same-origin frame is unavailable");
	}
	frameDocument.body.append(frameDocument.adoptNode(element));
	return frameDocument;
};

describe("TooltipElement", () => {
	test("owns manual tooltip semantics and preserves authored description tokens", () => {
		const { element, popup, trigger } = create();
		expect(element.trigger).toBe(trigger);
		expect(element.popup).toBe(popup);
		expect(popup.popover).toBe("manual");
		expect(popup.role).toBe("tooltip");
		expect(popup.id).not.toBe("");
		expect(trigger.getAttribute("aria-describedby")?.split(/\s+/u)).toEqual(["authored", popup.id]);

		const replacement = document.createElement("div");
		replacement.popover = "auto";
		popup.replaceWith(replacement);
		expect(element.trigger).toBe(trigger);
		expect(popup.popover).toBe("auto");
		expect(popup.getAttribute("role")).toBeNull();
		expect(trigger.getAttribute("aria-describedby")).toBe(`authored ${replacement.id}`);
	});

	test("generates a tree-scoped collision-free ID without Crypto.randomUUID and rechecks it on reconnect", () => {
		const name = `base-tooltip-no-crypto-${crypto.randomUUID()}`;
		customElements.define(name, class extends TooltipElement {});
		const descriptor = Object.getOwnPropertyDescriptor(window.crypto, "randomUUID");
		Object.defineProperty(window.crypto, "randomUUID", { configurable: true, value: undefined });
		try {
			const firstContainer = document.createElement("div");
			const firstRoot = firstContainer.attachShadow({ mode: "open" });
			const element = document.createElement(name) as TooltipElement;
			const trigger = document.createElement("button");
			const popup = document.createElement("div");
			popup.popover = "manual";
			element.append(trigger, popup);
			firstRoot.append(element);
			document.body.append(firstContainer);
			fixtures.push(firstContainer);

			expect(popup.id).toMatch(/^base-tooltip-\d+$/u);
			expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);
			const firstId = popup.id;

			const secondContainer = document.createElement("div");
			const secondRoot = secondContainer.attachShadow({ mode: "open" });
			const collision = document.createElement("i");
			collision.id = firstId;
			secondRoot.append(collision);
			document.body.append(secondContainer);
			fixtures.push(secondContainer);
			secondRoot.append(element);

			expect(popup.id).not.toBe(firstId);
			expect(secondRoot.getElementById(firstId)).toBe(collision);
			expect(secondRoot.getElementById(popup.id)).toBe(popup);
			expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);

			const reconnectedId = popup.id;
			firstRoot.append(element);
			expect(popup.id).toBe(reconnectedId);
			expect(firstRoot.getElementById(reconnectedId)).toBe(popup);
		} finally {
			if (descriptor) {
				Object.defineProperty(window.crypto, "randomUUID", descriptor);
			} else {
				Reflect.deleteProperty(window.crypto, "randomUUID");
			}
		}
	});

	test("preserves an explicit popup role and leaves its suitability to the author", () => {
		const { popup } = create();
		popup.role = "note";
		return wait().then(() => expect(popup.role).toBe("note"));
	});

	test("removes only its description token when the popup disappears after author edits", async () => {
		const { element, popup, trigger } = create();
		const ownedId = popup.id;
		trigger.setAttribute("aria-describedby", `authored ${ownedId} appended`);
		await wait();
		popup.remove();
		expect(element.trigger).toBe(trigger);
		expect(trigger.getAttribute("aria-describedby")).toBe("authored appended");
	});

	test("opens after mouse hover delay, ignores touch hover, and closes after leaving", async () => {
		const { element, popup, trigger } = create(20, 20);
		trigger.inert = true;
		pointer(trigger, "pointerover", "touch");
		await wait(30);
		expect(element.open).toBe(false);

		trigger.inert = false;
		pointer(trigger, "pointerover", "mouse");
		await wait(5);
		expect(element.open).toBe(false);
		await wait(25);
		expect(element.open).toBe(true);

		pointer(trigger, "pointerout", "mouse");
		await wait(5);
		expect(element.open).toBe(true);
		await wait(25);
		expect(popup.matches(":popover-open")).toBe(false);
	});

	test("opens on focus without moving it and Escape closes cleanly", async () => {
		const { element, trigger } = create(1_000);
		trigger.focus();
		expect(element.open).toBe(true);
		expect(document.activeElement).toBe(trigger);

		await userEvent.keyboard("{Escape}");
		expect(element.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
	});

	test("releases each native close-watcher signal before the connection ends", async () => {
		const { element } = create();
		const descriptor = Object.getOwnPropertyDescriptor(window, "CloseWatcher");
		const signals: AbortSignal[] = [];
		let destroyed = 0;
		class FakeCloseWatcher extends EventTarget {
			constructor(options?: { signal?: AbortSignal }) {
				super();
				if (options?.signal) {
					signals.push(options.signal);
					options.signal.addEventListener("abort", () => this.destroy(), { once: true });
				}
			}

			destroy(): void {
				++destroyed;
			}
		}
		Object.defineProperty(window, "CloseWatcher", { configurable: true, value: FakeCloseWatcher });

		try {
			element.show();
			expect(signals).toHaveLength(1);
			expect(signals[0]?.aborted).toBe(false);
			element.hide();
			expect(signals[0]?.aborted).toBe(true);
			expect(destroyed).toBe(1);

			await wait();
			element.show();
			expect(signals).toHaveLength(2);
			expect(signals[1]?.aborted).toBe(false);
			element.remove();
			expect(signals[1]?.aborted).toBe(true);
			expect(destroyed).toBe(2);
		} finally {
			if (element.isConnected) {
				element.remove();
			}
			if (descriptor) {
				Object.defineProperty(window, "CloseWatcher", descriptor);
			} else {
				Reflect.deleteProperty(window, "CloseWatcher");
			}
		}
	});

	test("allocates no close watcher when the popup target cancels opening", async () => {
		const { element, popup } = create();
		const descriptor = Object.getOwnPropertyDescriptor(window, "CloseWatcher");
		let constructed = 0;
		class FakeCloseWatcher extends EventTarget {
			constructor() {
				super();
				++constructed;
			}

			destroy(): void {}
		}
		Object.defineProperty(window, "CloseWatcher", { configurable: true, value: FakeCloseWatcher });
		popup.addEventListener("beforetoggle", (event) => event.preventDefault());

		try {
			element.show();
			expect(element.open).toBe(false);
			await Promise.resolve();
			expect(constructed).toBe(0);

			expect(element.toggle()).toBe(false);
			await Promise.resolve();
			expect(constructed).toBe(0);

			popup.showPopover();
			expect(element.open).toBe(false);
			await Promise.resolve();
			expect(constructed).toBe(0);
		} finally {
			if (descriptor) {
				Object.defineProperty(window, "CloseWatcher", descriptor);
			} else {
				Reflect.deleteProperty(window, "CloseWatcher");
			}
		}
	});

	test("acquires native close requests for direct and toggle openings with their source", async () => {
		const { element, popup, trigger } = create();
		const sources: (Element | null)[] = [];
		element.addEventListener("beforetoggle", (event) => {
			if (event.newState === "open") {
				sources.push(event.source);
			}
		});

		popup.showPopover({ source: trigger });
		await Promise.resolve();
		expect(element.open).toBe(true);
		await userEvent.keyboard("{Escape}");
		expect(element.open).toBe(false);

		expect(element.toggle(trigger)).toBe(true);
		expect(element.open).toBe(true);
		await userEvent.keyboard("{Escape}");
		expect(element.open).toBe(false);
		expect(sources).toEqual([trigger, trigger]);
	});

	test("settles a trusted hover opening that the popup target cancels", async () => {
		const { element, popup, trigger } = create();
		let attempts = 0;
		popup.addEventListener("beforetoggle", (event) => {
			if (event.newState === "open") {
				++attempts;
				event.preventDefault();
			}
		});

		await userEvent.hover(trigger);
		await wait();
		expect(element.open).toBe(false);
		expect(attempts).toBe(1);
	});

	test("closes when the current trigger is replaced and restores the old description", async () => {
		const { element, popup, trigger } = create();
		trigger.focus();
		expect(element.open).toBe(true);
		const replacement = document.createElement("button");
		replacement.slot = "trigger";
		trigger.replaceWith(replacement);

		expect(element.trigger).toBe(replacement);
		expect(element.open).toBe(false);
		expect(trigger.getAttribute("aria-describedby")).toBe("authored");
		expect(replacement.getAttribute("aria-describedby")).toBe(popup.id);
		await wait();
		expect(element.open).toBe(false);
	});

	test("defers a background tooltip and modal close request to the fresh realm's native group", async () => {
		const { element, trigger } = create();
		const frameDocument = adoptIntoFreshFrame(element);
		trigger.focus();
		expect(element.open).toBe(true);
		const dialog = frameDocument.createElement("dialog");
		const button = frameDocument.createElement("button");
		button.autofocus = true;
		dialog.append(button);
		frameDocument.body.append(dialog);
		dialog.showModal();

		await userEvent.keyboard("{Escape}");
		expect(element.open && dialog.open).toBe(false);
		if (element.open) {
			element.hide();
		}
		if (dialog.open) {
			dialog.close();
		}
	});

	test("defers a tooltip inside a modal to the fresh realm's native close-watcher group", async () => {
		const { element, trigger } = create();
		const frameDocument = adoptIntoFreshFrame(element);
		const dialog = frameDocument.createElement("dialog");
		const focusTarget = frameDocument.createElement("button");
		dialog.append(focusTarget, element);
		frameDocument.body.append(dialog);
		dialog.showModal();
		focusTarget.focus();
		pointer(trigger, "pointerover", "mouse");
		await wait();
		expect(element.open).toBe(true);

		await userEvent.keyboard("{Escape}");
		expect(element.open && dialog.open).toBe(false);
		if (element.open) {
			element.hide();
		}
		if (dialog.open) {
			dialog.close();
		}
	});

	test("defers Tooltip and auto-popover close ordering to the fresh realm's native group", async () => {
		const { element, trigger } = create();
		const frameDocument = adoptIntoFreshFrame(element);
		const source = frameDocument.createElement("button");
		const auto = frameDocument.createElement("div");
		auto.popover = "auto";
		frameDocument.body.append(source, auto);
		auto.showPopover({ source });
		pointer(trigger, "pointerover", "mouse");
		await wait();
		expect(element.open).toBe(true);
		expect(auto.matches(":popover-open")).toBe(true);
		source.focus();

		await userEvent.keyboard("{Escape}");
		expect(element.open && auto.matches(":popover-open")).toBe(false);
		if (element.open) {
			element.hide();
		}
		if (auto.matches(":popover-open")) {
			auto.hidePopover();
		}
	});

	test("honors canceled opening and clears stale delayed work across replacement and reconnect", async () => {
		const { element, popup, trigger } = create(20);
		element.addEventListener("beforetoggle", (event) => {
			if (event.newState === "open") {
				event.preventDefault();
			}
		});
		trigger.focus();
		expect(element.open).toBe(false);
		trigger.blur();

		pointer(trigger, "pointerover", "mouse");
		const replacement = document.createElement("div");
		replacement.popover = "manual";
		popup.replaceWith(replacement);
		element.remove();
		await wait(30);
		expect(replacement.matches(":popover-open")).toBe(false);

		document.body.append(element);
		pointer(trigger, "pointerover", "mouse");
		await wait(30);
		expect(element.open).toBe(false);
	});

	test("preserves an already-open native popup during late custom-element upgrade", () => {
		const name = `base-tooltip-${crypto.randomUUID()}`;
		const element = document.createElement(name);
		const trigger = document.createElement("button");
		const popup = document.createElement("div");
		popup.popover = "manual";
		element.append(trigger, popup);
		document.body.append(element);
		fixtures.push(element);
		popup.showPopover({ source: trigger });
		expect(popup.matches(":popover-open")).toBe(true);

		customElements.define(name, class extends TooltipElement {});
		expect((element as TooltipElement).trigger).toBe(trigger);
		expect((element as TooltipElement).open).toBe(true);
		(element as TooltipElement).hide();
	});

	test("recreates its native close watcher after disconnect and adoption", async () => {
		const { element, trigger } = create();
		trigger.focus();
		expect(element.open).toBe(true);
		element.remove();
		expect(element.open).toBe(false);

		const frame = document.createElement("iframe");
		document.body.append(frame);
		fixtures.push(frame);
		const frameDocument = frame.contentDocument;
		if (!frameDocument) {
			throw new Error("Same-origin frame is unavailable");
		}
		frameDocument.body.append(frameDocument.adoptNode(element));
		trigger.focus();
		expect(element.open).toBe(true);
		await userEvent.keyboard("{Escape}");
		expect(element.open).toBe(false);
	});

	test("fails before opening without CloseWatcher while allowing a native closing toggle", () => {
		const { element } = create();
		const descriptor = Object.getOwnPropertyDescriptor(window, "CloseWatcher");
		const restore = (): void => {
			if (descriptor) {
				Object.defineProperty(window, "CloseWatcher", descriptor);
			} else {
				Reflect.deleteProperty(window, "CloseWatcher");
			}
		};

		try {
			Object.defineProperty(window, "CloseWatcher", { configurable: true, value: undefined });
			expect(() => element.show()).toThrowError(expect.objectContaining({ name: "NotSupportedError" }));
			expect(element.open).toBe(false);
			expect(() => element.toggle()).toThrowError(expect.objectContaining({ name: "NotSupportedError" }));
			expect(element.open).toBe(false);

			restore();
			element.show();
			expect(element.open).toBe(true);
			Object.defineProperty(window, "CloseWatcher", { configurable: true, value: undefined });
			expect(element.toggle()).toBe(false);
			expect(element.open).toBe(false);
		} finally {
			restore();
		}
	});
});
