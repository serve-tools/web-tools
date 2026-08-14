import { describe, expect, test, vi } from "vitest";
import type { DropEndState } from "../src/lib/drop.js";
import { observeDropTarget } from "../src/lib/drop.js";

const createDragEvent = (type: string): DragEvent => new Event(type, { cancelable: true }) as DragEvent;

class DropTargetStub {
	readonly #listeners = new Map<string, Set<EventListener>>();

	addEventListener(type: string, listener: EventListener): void {
		let listeners = this.#listeners.get(type);

		if (listeners === undefined) {
			listeners = new Set();
			this.#listeners.set(type, listeners);
		}

		listeners.add(listener);
	}

	emit(event: DragEvent): void {
		for (const listener of [...(this.#listeners.get(event.type) ?? [])]) listener.call(this, event);
	}

	removeEventListener(type: string, listener: EventListener): void {
		this.#listeners.get(type)?.delete(listener);
	}
}

describe(observeDropTarget.name, (): void => {
	test("normalizes nested dragenter and dragleave events into one session", (): void => {
		const target = new EventTarget();
		const starts: DragEvent[] = [];
		const overs: DragEvent[] = [];
		const ends: Array<[DropEndState, DragEvent | undefined]> = [];

		observeDropTarget(target as Element, {
			start(event) {
				expect(this).toBe(target);
				starts.push(event);
			},
			over(event) {
				overs.push(event);
			},
			end(state, event) {
				ends.push([state, event]);
			},
		});

		const firstEnter = createDragEvent("dragenter");
		const over = createDragEvent("dragover");
		const firstLeave = createDragEvent("dragleave");
		const finalLeave = createDragEvent("dragleave");

		target.dispatchEvent(firstEnter);
		target.dispatchEvent(createDragEvent("dragenter"));
		target.dispatchEvent(over);
		target.dispatchEvent(firstLeave);

		expect(starts).toEqual([firstEnter]);
		expect(overs).toEqual([over]);
		expect(ends).toHaveLength(0);

		target.dispatchEvent(finalLeave);

		expect(ends).toEqual([[{ reason: "leave" }, finalLeave]]);
	});

	test("leaves default prevention under handler control", (): void => {
		const target = new EventTarget();
		const over = vi.fn((event: DragEvent): void => event.preventDefault());

		observeDropTarget(target as Element, {});
		expect(target.dispatchEvent(createDragEvent("dragover"))).toBe(true);

		observeDropTarget(target as Element, { over });
		expect(target.dispatchEvent(createDragEvent("dragover"))).toBe(false);
		expect(over).toHaveBeenCalledOnce();
	});

	test("treats drop as terminal and can begin another session", (): void => {
		const target = new EventTarget();
		const start = vi.fn();
		const end = vi.fn();

		observeDropTarget(target as Element, { start, end });
		target.dispatchEvent(createDragEvent("dragenter"));
		const drop = createDragEvent("drop");
		target.dispatchEvent(drop);
		target.dispatchEvent(createDragEvent("dragover"));

		expect(start).toHaveBeenCalledTimes(2);
		expect(end).toHaveBeenCalledOnce();
		expect(end).toHaveBeenCalledWith({ reason: "drop" }, drop);
	});

	test("starts from dragover without corrupting later enter and leave depth", (): void => {
		const target = new EventTarget();
		const start = vi.fn();
		const end = vi.fn();

		observeDropTarget(target as Element, { start, end });
		target.dispatchEvent(createDragEvent("dragover"));
		target.dispatchEvent(createDragEvent("dragenter"));
		const leave = createDragEvent("dragleave");
		target.dispatchEvent(leave);

		expect(start).toHaveBeenCalledOnce();
		expect(end).toHaveBeenCalledWith({ reason: "leave" }, leave);
	});

	test("stops an active session once and removes every listener", (): void => {
		const target = new EventTarget();
		const start = vi.fn();
		const over = vi.fn();
		const end = vi.fn();
		const stop = observeDropTarget(target as Element, { start, over, end });

		target.dispatchEvent(createDragEvent("dragenter"));
		stop();
		stop();

		expect(end).toHaveBeenCalledOnce();
		expect(end).toHaveBeenCalledWith({ reason: "stopped" }, undefined);

		target.dispatchEvent(createDragEvent("dragover"));
		expect(start).toHaveBeenCalledOnce();
		expect(over).not.toHaveBeenCalled();
	});

	test("supports already-aborted and active AbortSignals", (): void => {
		const target = new EventTarget();
		const alreadyAborted = new AbortController();
		const start = vi.fn();

		alreadyAborted.abort();
		observeDropTarget(target as Element, { start }, { signal: alreadyAborted.signal });
		target.dispatchEvent(createDragEvent("dragenter"));
		expect(start).not.toHaveBeenCalled();

		const controller = new AbortController();
		const end = vi.fn();

		observeDropTarget(target as Element, { end }, { signal: controller.signal });
		target.dispatchEvent(createDragEvent("dragenter"));
		controller.abort();

		expect(end).toHaveBeenCalledWith({ reason: "stopped" }, undefined);
	});

	test("restores internal state after start and end handlers throw", (): void => {
		const target = new DropTargetStub();
		const startError = new Error("start");
		const endError = new Error("end");
		let starts = 0;
		let ends = 0;

		observeDropTarget(target as unknown as Element, {
			start() {
				if (++starts === 1) throw startError;
			},
			end() {
				if (++ends === 1) throw endError;
			},
		});

		expect(() => target.emit(createDragEvent("dragenter"))).toThrow(startError);
		expect(() => target.emit(createDragEvent("dragover"))).not.toThrow();
		expect(() => target.emit(createDragEvent("drop"))).toThrow(endError);
		expect(() => target.emit(createDragEvent("dragover"))).not.toThrow();
		expect(starts).toBe(3);
	});
});
