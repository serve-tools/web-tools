import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ScrollAreaElement } from "../../src/scroll-area-element.js";

const fixtures: Node[] = [];
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const create = async (dir = "ltr") => {
	const name = `aui-scroll-area-${crypto.randomUUID()}`;
	customElements.define(name, class extends ScrollAreaElement {});
	const element = document.createElement(name) as ScrollAreaElement;
	const viewport = document.createElement("div");
	const content = document.createElement("div");
	const railX = document.createElement("div");
	const railY = document.createElement("div");
	const thumbX = document.createElement("div");
	const thumbY = document.createElement("div");
	viewport.slot = "viewport";
	viewport.dir = dir;
	viewport.tabIndex = 0;
	viewport.style.cssText = "width:100px;height:100px;overflow:auto";
	content.slot = "content";
	content.style.cssText = "width:300px;height:400px";
	railX.slot = "scrollbar-x";
	railY.slot = "scrollbar-y";
	railX.style.cssText = "width:100px;height:10px";
	railY.style.cssText = "width:10px;height:100px";
	thumbX.slot = "thumb-x";
	thumbY.slot = "thumb-y";
	thumbX.style.cssText = "width:20px;height:10px";
	thumbY.style.cssText = "width:10px;height:20px";
	viewport.append(content);
	railX.append(thumbX);
	railY.append(thumbY);
	element.append(viewport, railX, railY);
	document.body.append(element);
	fixtures.push(element);
	await frame();
	return { content, element, railX, railY, thumbX, thumbY, viewport };
};

const pointer = (target: Element, type: string, x: number, y: number) =>
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			button: 0,
			cancelable: true,
			clientX: x,
			clientY: y,
			isPrimary: true,
			pointerId: 3,
		}),
	);

describe("ScrollAreaElement", () => {
	test("keeps the native viewport as the sole scroller and publishes frozen metrics", async () => {
		const { element, railX, railY, viewport } = await create();
		expect(element.viewport).toBe(viewport);
		expect(railX.getAttribute("aria-hidden")).toBe("true");
		expect(railY.getAttribute("aria-hidden")).toBe("true");
		expect(element.metrics.maxBlock).toBeCloseTo(300, 0);
		expect(element.metrics.maxInline).toBeCloseTo(200, 0);
		expect(Object.isFrozen(element.metrics)).toBe(true);
		element.scrollTo(50, 70);
		await frame();
		expect(viewport.scrollLeft).toBeCloseTo(50, 0);
		expect(viewport.scrollTop).toBeCloseTo(70, 0);
		expect(element.metrics.block).toBeCloseTo(70, 0);
		expect(element.metrics.inline).toBeCloseTo(50, 0);
	});

	test("thumb dragging changes only native scroll offsets and preserves native viewport events", async () => {
		const { element, thumbY, viewport } = await create();
		vi.spyOn(thumbY, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 10, 20));
		vi.spyOn(thumbY, "setPointerCapture").mockImplementation(() => {});
		vi.spyOn(thumbY, "hasPointerCapture").mockReturnValue(true);
		vi.spyOn(thumbY, "releasePointerCapture").mockImplementation(() => {});
		const scroll = vi.fn();
		viewport.addEventListener("scroll", scroll);
		const emit = (type: string, y: number) =>
			thumbY.dispatchEvent(
				new PointerEvent(type, { bubbles: true, button: 0, clientY: y, isPrimary: true, pointerId: 2 }),
			);
		emit("pointerdown", 0);
		emit("pointermove", 80);
		emit("pointerup", 80);
		await frame();
		expect(viewport.scrollTop).toBeGreaterThan(0);
		expect(element.metrics.block).toBe(viewport.scrollTop);
		expect(scroll).toHaveBeenCalled();
	});

	test("rejects structurally stale thumb sessions", async () => {
		const { railY, thumbY, viewport } = await create();
		vi.spyOn(thumbY, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 10, 20));
		vi.spyOn(thumbY, "setPointerCapture").mockImplementation(() => {});
		vi.spyOn(thumbY, "hasPointerCapture").mockReturnValue(true);
		vi.spyOn(thumbY, "releasePointerCapture").mockImplementation(() => {});
		const initial = viewport.scrollTop;
		pointer(thumbY, "pointerdown", 0, 0);
		railY.remove();
		pointer(thumbY, "pointermove", 0, -80);
		pointer(thumbY, "pointerup", 0, -80);
		expect(viewport.scrollTop).toBe(initial);
	});

	test("leaves trusted keyboard scrolling on the native viewport", async () => {
		const { viewport } = await create();
		let keydown: KeyboardEvent | undefined;
		viewport.addEventListener("keydown", (event) => (keydown = event));
		viewport.focus();
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(viewport);
		expect(keydown?.isTrusted).toBe(true);
		expect(keydown?.defaultPrevented).toBe(false);
	});

	test("normalizes RTL inline metrics and delegates physical native scrolling", async () => {
		const { element, viewport } = await create("rtl");
		viewport.scrollLeft = -60;
		await frame();
		expect(element.metrics.inline).toBeCloseTo(60, 0);
		expect(element.metrics.maxInline).toBeCloseTo(200, 0);
	});

	test("rebinds replacements, restores presentation attributes, and reacquires after adoption", async () => {
		const { element, railX, railY, viewport } = await create();
		const replacement = document.createElement("div");
		replacement.slot = "viewport";
		replacement.style.cssText = "width:50px;height:50px;overflow:auto";
		viewport.replaceWith(replacement);
		expect(element.metrics.clientWidth).toBeCloseTo(50, 0);
		await frame();
		await frame();
		expect(element.viewport).toBe(replacement);
		expect(railY.style.getPropertyValue("--aui-scroll-thumb-size")).not.toBe("");
		railX.style.setProperty("--aui-scroll-thumb-size", "author");
		element.remove();
		expect(railY.hasAttribute("aria-hidden")).toBe(false);
		expect(railY.style.getPropertyValue("--aui-scroll-thumb-size")).toBe("");
		expect(railY.style.getPropertyValue("--aui-scroll-thumb-offset")).toBe("");
		expect(railX.style.getPropertyValue("--aui-scroll-thumb-size")).toBe("author");
		const iframe = document.createElement("iframe");
		document.body.append(iframe);
		fixtures.push(iframe);
		iframe.contentDocument!.body.append(iframe.contentDocument!.adoptNode(element));
		await new Promise<void>((resolve) => iframe.contentWindow!.requestAnimationFrame(() => resolve()));
		expect(element.ownerDocument).toBe(iframe.contentDocument);
		expect(element.viewport).toBe(replacement);
	});

	test("restores authored style values and priorities after forced ownership", async () => {
		const { element, railY, thumbY } = await create();
		element.remove();
		await Promise.resolve();
		railY.style.setProperty("--aui-scroll-thumb-size", "7px", "important");
		railY.style.setProperty("--aui-scroll-thumb-offset", "3px", "important");
		thumbY.style.setProperty("touch-action", "pan-x", "important");
		void element.metrics;
		expect(railY.hasAttribute("aria-hidden")).toBe(false);
		document.body.append(element);
		void element.metrics;
		expect(railY.style.getPropertyPriority("--aui-scroll-thumb-size")).toBe("");
		expect(thumbY.style.getPropertyValue("touch-action")).toBe("none");
		element.remove();
		expect(railY.style.getPropertyValue("--aui-scroll-thumb-size")).toBe("7px");
		expect(railY.style.getPropertyPriority("--aui-scroll-thumb-size")).toBe("important");
		expect(railY.style.getPropertyValue("--aui-scroll-thumb-offset")).toBe("3px");
		expect(railY.style.getPropertyPriority("--aui-scroll-thumb-offset")).toBe("important");
		expect(thumbY.style.getPropertyValue("touch-action")).toBe("pan-x");
		expect(thumbY.style.getPropertyPriority("touch-action")).toBe("important");
	});

	test("ignores rails whose subtree could remain keyboard-focusable while aria hidden", async () => {
		const { railY, thumbY } = await create();
		const button = document.createElement("button");
		button.slot = "thumb-y";
		thumbY.replaceWith(button);
		await Promise.resolve();
		expect(railY.hasAttribute("aria-hidden")).toBe(false);
		button.focus();
		expect(document.activeElement).toBe(button);
	});
});
