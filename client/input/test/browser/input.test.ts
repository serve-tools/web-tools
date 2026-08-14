import { expect, test, vi } from "vitest";

import { observeDropTarget } from "../../src/lib/drop.js";
import { observePointer } from "../../src/lib/pointer.js";

test("observes DOM pointer events without taking propagation ownership", (): void => {
	const parent = document.createElement("div");
	const element = document.createElement("button");
	const bubbled = vi.fn();
	const end = vi.fn();
	let captured: number | undefined;

	parent.append(element);
	document.body.append(parent);
	parent.addEventListener("pointerdown", bubbled);
	vi.spyOn(element, "setPointerCapture").mockImplementation((pointerId) => {
		captured = pointerId;
	});
	vi.spyOn(element, "hasPointerCapture").mockImplementation((pointerId) => captured === pointerId);
	vi.spyOn(element, "releasePointerCapture").mockImplementation(() => {
		captured = undefined;
	});

	const stop = observePointer(element, {
		start(_state, event) {
			event.preventDefault();
		},
		end,
	});
	const pointerDown = new PointerEvent("pointerdown", {
		bubbles: true,
		cancelable: true,
		clientX: 20,
		clientY: 30,
		pointerId: 12,
		pointerType: "mouse",
	});

	expect(element.dispatchEvent(pointerDown)).toBe(false);
	expect(bubbled).toHaveBeenCalledOnce();
	expect(captured).toBe(12);

	stop();

	expect(end).toHaveBeenCalledWith(expect.objectContaining({ reason: "stopped" }), undefined);
	expect(captured).toBeUndefined();
	parent.remove();
});

test("normalizes bubbling drag events while leaving drop acceptance explicit", (): void => {
	const dropZone = document.createElement("div");
	const child = document.createElement("span");
	const start = vi.fn();
	const end = vi.fn();

	dropZone.append(child);
	document.body.append(dropZone);
	const stop = observeDropTarget(dropZone, {
		start,
		over(event) {
			event.preventDefault();
		},
		end,
	});

	child.dispatchEvent(new DragEvent("dragenter", { bubbles: true }));
	expect(child.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true }))).toBe(false);
	const drop = new DragEvent("drop", { bubbles: true, cancelable: true });
	child.dispatchEvent(drop);

	expect(start).toHaveBeenCalledOnce();
	expect(end).toHaveBeenCalledWith({ reason: "drop" }, drop);

	stop();
	dropZone.remove();
});
