import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { PopoverElement } from "../../src/popover-element.js";

const fixtures: Element[] = [];
const task = () => new Promise<void>((resolve) => setTimeout(resolve));

afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.remove();
	}
	vi.restoreAllMocks();
});

const create = (): { element: PopoverElement; popup: HTMLDivElement } => {
	const name = `aui-popover-${crypto.randomUUID()}`;
	customElements.define(name, class extends PopoverElement {});
	const element = document.createElement(name) as PopoverElement;
	const popup = document.createElement("div");
	popup.popover = "auto";
	element.append(popup);
	document.body.append(element);
	fixtures.push(element);
	return { element, popup };
};

describe("PopoverElement", () => {
	test("delegates state and methods to the current direct native popover", async () => {
		const { element, popup } = create();
		expect(element.popup).toBe(popup);
		expect(element.open).toBe(false);

		element.show();
		expect(element.open).toBe(true);
		expect(element.toggle()).toBe(false);
		expect(element.open).toBe(false);
		expect(element.toggle()).toBe(true);
		element.hide();
		await task();

		const replacement = document.createElement("section");
		replacement.popover = "manual";
		popup.replaceWith(replacement);
		expect(element.popup).toBe(replacement);
		element.show();
		expect(replacement.matches(":popover-open")).toBe(true);
		element.hide();
	});

	test("defines missing-popup behavior", () => {
		const name = `aui-popover-${crypto.randomUUID()}`;
		customElements.define(name, class extends PopoverElement {});
		const element = document.createElement(name) as PopoverElement;
		document.body.append(element);
		fixtures.push(element);

		expect(element.popup).toBeNull();
		expect(element.open).toBe(false);
		for (const operation of [() => element.show(), () => element.hide(), () => element.toggle()]) {
			expect(operation).toThrowError(expect.objectContaining({ name: "InvalidStateError" }));
		}
	});

	test("forwards cancelable opening and honors cancellation", async () => {
		const { element, popup } = create();
		const states: string[] = [];
		element.addEventListener("beforetoggle", (event) => {
			states.push(`${event.oldState}:${event.newState}:${event.cancelable}`);
			if (event.newState === "open") {
				event.preventDefault();
			}
		});

		element.show();
		expect(popup.matches(":popover-open")).toBe(false);
		expect(states).toEqual(["closed:open:true"]);
		await task();
	});

	test("forwards native closing as noncancelable and never reopens it", async () => {
		const { element, popup } = create();
		const closing: ToggleEvent[] = [];
		element.addEventListener("beforetoggle", (event) => {
			if (event.newState === "closed") {
				closing.push(event);
				event.preventDefault();
			}
		});

		element.show();
		element.hide();
		expect(popup.matches(":popover-open")).toBe(false);
		expect(closing).toHaveLength(1);
		expect(closing[0]?.cancelable).toBe(false);
		await task();
		expect(popup.matches(":popover-open")).toBe(false);
	});

	test("preserves native external invokers and source association", async () => {
		const { element, popup } = create();
		popup.id = crypto.randomUUID();
		const button = document.createElement("button");
		button.popoverTargetElement = popup;
		element.before(button);
		fixtures.push(button);
		let source: Element | null | undefined;
		element.addEventListener("beforetoggle", (event) => {
			if (event.newState === "open") {
				source = event.source;
			}
		});

		await userEvent.click(button);
		expect(element.open).toBe(true);
		expect(source).toBe(button);
		element.hide();
	});

	test("uses the adopted document realm and does not duplicate forwarding on reconnect", async () => {
		const { element } = create();
		const frame = document.createElement("iframe");
		document.body.append(frame);
		fixtures.push(frame);
		const frameDocument = frame.contentDocument;
		const FrameToggleEvent = frameDocument?.defaultView?.ToggleEvent;
		if (!frameDocument || !FrameToggleEvent) {
			throw new Error("Same-origin frame is unavailable");
		}

		frameDocument.body.append(frameDocument.adoptNode(element));
		let forwarded: Event | undefined;
		let toggles = 0;
		element.addEventListener("toggle", (event) => {
			forwarded = event;
			++toggles;
		});
		element.show();
		await task();
		expect(forwarded).toBeInstanceOf(FrameToggleEvent);
		element.hide();
		await task();
		const beforeReconnect = toggles;
		element.remove();
		frameDocument.body.append(element);
		element.show();
		await task();
		expect(toggles).toBe(beforeReconnect + 1);
		element.hide();
	});
});
