import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { DrawerElement } from "../../src/drawer-element.js";

const fixtures: Node[] = [];
afterEach(() => {
	for (const fixture of fixtures.splice(0).reverse()) {
		fixture.parentNode?.removeChild(fixture);
	}
	vi.restoreAllMocks();
});

const create = () => {
	const name = `aui-drawer-${crypto.randomUUID()}`;
	customElements.define(name, class extends DrawerElement {});
	const element = document.createElement(name) as DrawerElement;
	const dialog = document.createElement("dialog");
	const handle = document.createElement("div");
	const content = document.createElement("main");
	handle.slot = "handle";
	dialog.append(handle, content);
	element.append(dialog);
	document.body.append(element);
	fixtures.push(element);
	return { content, dialog, element, handle };
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
			pointerId: 1,
		}),
	);

const prepareGesture = (dialog: HTMLDialogElement, handle: HTMLElement) => {
	vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));
	vi.spyOn(handle, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 20));
	vi.spyOn(handle, "setPointerCapture").mockImplementation(() => {});
	vi.spyOn(handle, "hasPointerCapture").mockReturnValue(true);
	vi.spyOn(handle, "releasePointerCapture").mockImplementation(() => {});
};

describe("DrawerElement", () => {
	test("keeps the authored dialog as native focus, modality, and form authority", async () => {
		const { dialog, element } = create();
		const opener = document.createElement("button");
		const initial = document.createElement("button");
		initial.autofocus = true;
		document.body.prepend(opener);
		fixtures.push(opener);
		dialog.append(initial);
		opener.focus();
		element.showModal();
		expect(element.dialog).toBe(dialog);
		expect(document.activeElement).toBe(initial);
		await userEvent.keyboard("{Escape}");
		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(opener);
	});

	test("validates frozen fraction snaps and writes side-aware CSS values", () => {
		const { element } = create();
		element.side = "left";
		element.snapPoints = [1, 0.5, 0, 0.5];
		expect(element.snapPoints).toEqual([0, 0.5, 1]);
		expect(Object.isFrozen(element.snapPoints)).toBe(true);
		element.snapTo(0.5);
		expect(element.snapPoint).toBe(0.5);
		expect(element.style.getPropertyValue("--aui-drawer-progress")).toBe("0.5");
		expect(() => (element.snapPoints = [-1])).toThrow(TypeError);
		expect(() => ((element as DrawerElement).side = "center" as never)).toThrow(TypeError);
	});

	test("uses only the scoped handle and lets native cancel veto a gesture close", () => {
		const { content, dialog, element, handle } = create();
		prepareGesture(dialog, handle);
		element.show();
		const before = vi.fn();
		element.addEventListener("beforesnap", before);
		element.addEventListener("cancel", (event) => event.preventDefault(), { once: true });

		pointer(content, "pointerdown", 0, 0);
		pointer(content, "pointerup", 0, 100);
		expect(before).not.toHaveBeenCalled();
		pointer(handle, "pointerdown", 0, 0);
		pointer(handle, "pointermove", 0, 100);
		pointer(handle, "pointerup", 0, 100);
		expect(before).toHaveBeenCalledOnce();
		expect(dialog.open).toBe(true);
		expect(element.snapPoint).toBe(1);
		element.close();
	});

	test("rejects stale, reentrant, and ancestor-cancelled gesture transactions", () => {
		const { dialog, element, handle } = create();
		prepareGesture(dialog, handle);
		element.show();
		const before = vi.fn();
		const change = vi.fn();
		element.addEventListener("beforesnap", before);
		element.addEventListener("snapchange", change);

		pointer(handle, "pointerdown", 0, 0);
		element.snapTo(0.5);
		pointer(handle, "pointerup", 0, 100);
		expect(element.snapPoint).toBe(0.5);
		expect(before).not.toHaveBeenCalled();

		element.snapTo(1);
		element.addEventListener(
			"beforesnap",
			() => {
				element.remove();
				document.body.append(element);
			},
			{ once: true },
		);
		pointer(handle, "pointerdown", 0, 0);
		pointer(handle, "pointerup", 0, 100);
		expect(change).not.toHaveBeenCalled();
		expect(element.snapPoint).toBe(1);

		const cancel = (event: Event) => event.preventDefault();
		document.addEventListener("pointerdown", cancel, { capture: true, once: true, passive: false });
		pointer(handle, "pointerdown", 0, 0);
		pointer(handle, "pointerup", 0, 100);
		expect(element.hasAttribute("data-dragging")).toBe(false);
		expect(before).toHaveBeenCalledOnce();
		dialog.close();
	});

	test("keeps open preparation failure-atomic and preserves close-listener writes", async () => {
		const { dialog, element, handle } = create();
		prepareGesture(dialog, handle);
		element.snapTo(0);
		dialog.show();
		expect(() => element.showModal()).toThrowError(expect.objectContaining({ name: "InvalidStateError" }));
		expect(element.snapPoint).toBe(0);
		dialog.close();
		await new Promise((resolve) => setTimeout(resolve, 0));
		element.snapTo(1);
		element.show();
		const change = vi.fn();
		element.addEventListener("snapchange", change);
		element.addEventListener("close", () => element.snapTo(0.5), { once: true });
		const closed = new Promise<void>((resolve) =>
			element.addEventListener("close", () => resolve(), { once: true }),
		);
		pointer(handle, "pointerdown", 0, 0);
		pointer(handle, "pointerup", 0, 100);
		await closed;
		expect(element.snapPoint).toBe(0.5);
		expect(change).not.toHaveBeenCalled();
	});

	test("preserves a newer programmatic snap written before the queued native close event", async () => {
		const { dialog, element, handle } = create();
		prepareGesture(dialog, handle);
		element.show();
		const change = vi.fn();
		element.addEventListener("snapchange", change);
		const closed = new Promise<void>((resolve) =>
			element.addEventListener("close", () => resolve(), { once: true }),
		);
		pointer(handle, "pointerdown", 0, 0);
		pointer(handle, "pointerup", 0, 100);
		expect(dialog.open).toBe(false);
		element.snapTo(0.5);
		await closed;
		expect(element.snapPoint).toBe(0.5);
		expect(change).not.toHaveBeenCalled();
	});

	test("cancels pointer work and restores handle styling across replacement and disconnect", () => {
		const { dialog, element, handle } = create();
		handle.style.setProperty("touch-action", "pan-x", "important");
		element.remove();
		document.body.append(element);
		expect(handle.style.touchAction).toBe("none");
		expect(handle.style.getPropertyPriority("touch-action")).toBe("");
		handle.style.setProperty("touch-action", "pan-y", "important");
		const replacement = document.createElement("div");
		replacement.slot = "handle";
		handle.replaceWith(replacement);
		return Promise.resolve().then(() => {
			expect(handle.style.touchAction).toBe("pan-y");
			expect(handle.style.getPropertyPriority("touch-action")).toBe("important");
			expect(replacement.style.touchAction).toBe("none");
			element.remove();
			expect(replacement.style.touchAction).toBe("");
			expect(dialog.isConnected).toBe(false);
		});
	});
});
