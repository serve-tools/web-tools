import { describe, expect, test, vi } from "vitest";
import type { PointerEndState, PointerState } from "../src/lib/pointer.js";
import { observePointer } from "../src/lib/pointer.js";

class PointerElement {
	readonly #captures = new Set<number>();
	readonly #listeners = new Map<string, Set<EventListener>>();

	rect = createRect(10, 20, 100, 200);

	addEventListener(type: string, listener: EventListener): void {
		let listeners = this.#listeners.get(type);

		if (listeners === undefined) {
			listeners = new Set();
			this.#listeners.set(type, listeners);
		}

		listeners.add(listener);
	}

	emit(type: string, event: PointerEvent): void {
		if (type === "lostpointercapture") this.#captures.delete(event.pointerId);

		try {
			for (const listener of [...(this.#listeners.get(type) ?? [])]) listener.call(this, event);
		} finally {
			if (type === "pointerup" || type === "pointercancel") this.#captures.delete(event.pointerId);
		}
	}

	getBoundingClientRect(): DOMRect {
		return this.rect;
	}

	hasPointerCapture(pointerId: number): boolean {
		return this.#captures.has(pointerId);
	}

	listenerCount(type?: string): number {
		if (type !== undefined) return this.#listeners.get(type)?.size ?? 0;

		let count = 0;

		for (const listeners of this.#listeners.values()) count += listeners.size;

		return count;
	}

	releasePointerCapture(pointerId: number): void {
		this.#captures.delete(pointerId);
	}

	removeEventListener(type: string, listener: EventListener): void {
		this.#listeners.get(type)?.delete(listener);
	}

	setPointerCapture(pointerId: number): void {
		this.#captures.add(pointerId);
	}
}

const createRect = (x: number, y: number, width: number, height: number): DOMRect =>
	({
		x,
		y,
		width,
		height,
		top: y,
		right: x + width,
		bottom: y + height,
		left: x,
	}) as DOMRect;

const createPointerEvent = (pointerId: number, clientX: number, clientY: number, pointerType = "mouse"): PointerEvent =>
	({
		pointerId,
		pointerType,
		clientX,
		clientY,
		preventDefault: vi.fn(),
		stopImmediatePropagation: vi.fn(),
	}) as unknown as PointerEvent;

const setup = () => {
	const target = new PointerElement();
	const element = target as unknown as Element;

	return { element, target };
};

describe(observePointer.name, (): void => {
	test("rejects a start without taking ownership of the event", (): void => {
		const { element, target } = setup();
		const event = createPointerEvent(3, 35, 70, "future-pointer");
		const start = vi.fn((_state: PointerState) => false);
		const move = vi.fn();
		const end = vi.fn();

		observePointer(element, { start, move, end });
		target.emit("pointerdown", event);

		expect(start).toHaveBeenCalledOnce();
		expect(start.mock.calls[0]?.[0]).toEqual({
			pointerId: 3,
			pointerType: "future-pointer",
			bounds: {
				x: 10,
				y: 20,
				width: 100,
				height: 200,
				top: 20,
				right: 110,
				bottom: 220,
				left: 10,
			},
			origin: { x: 35, y: 70 },
			position: { x: 35, y: 70 },
			delta: { x: 0, y: 0 },
			ratio: { x: 0.25, y: 0.25 },
		});
		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
		expect(target.hasPointerCapture(3)).toBe(false);
		expect(target.listenerCount("pointermove")).toBe(0);
		expect(move).not.toHaveBeenCalled();
		expect(end).not.toHaveBeenCalled();
	});

	test("tracks one accepted pointer against its initial bounds", (): void => {
		const { element, target } = setup();
		const starts: PointerState[] = [];
		const moves: PointerState[] = [];
		const ends: PointerEndState[] = [];

		observePointer(element, {
			start(state) {
				expect(this).toBe(element);
				starts.push(state);
			},
			move(state) {
				moves.push(state);
			},
			end(state) {
				ends.push(state);
			},
		});

		target.emit("pointerdown", createPointerEvent(1, 35, 70, "pen"));
		expect(target.hasPointerCapture(1)).toBe(true);

		target.emit("pointerdown", createPointerEvent(2, 40, 80));
		target.emit("pointermove", createPointerEvent(2, 100, 200));
		target.rect = createRect(0, 0, 10, 10);
		target.emit("pointermove", createPointerEvent(1, 60, 120, "pen"));
		target.emit("pointerup", createPointerEvent(1, 110, 220, "pen"));

		expect(starts).toHaveLength(1);
		expect(moves).toEqual([
			expect.objectContaining({
				position: { x: 60, y: 120 },
				delta: { x: 25, y: 50 },
				ratio: { x: 0.5, y: 0.5 },
			}),
		]);
		expect(ends).toEqual([
			expect.objectContaining({
				position: { x: 110, y: 220 },
				delta: { x: 75, y: 150 },
				ratio: { x: 1, y: 1 },
				reason: "up",
			}),
		]);
		expect(target.hasPointerCapture(1)).toBe(false);
		expect(target.listenerCount("pointermove")).toBe(0);
	});

	test.each([
		["pointercancel", "cancel"],
		["lostpointercapture", "lostcapture"],
	] as const)("reports %s as %s", (eventType, reason): void => {
		const { element, target } = setup();
		const end = vi.fn();

		observePointer(element, { end });
		target.emit("pointerdown", createPointerEvent(8, 20, 30));
		const event = createPointerEvent(8, 25, 35);

		target.emit(eventType, event);

		expect(end).toHaveBeenCalledWith(expect.objectContaining({ reason }), event);
		expect(target.listenerCount("pointermove")).toBe(0);
	});

	test("stops an active interaction once and releases capture", (): void => {
		const { element, target } = setup();
		const end = vi.fn();
		const stop = observePointer(element, { end });

		target.emit("pointerdown", createPointerEvent(4, 20, 30));
		target.emit("pointermove", createPointerEvent(4, 40, 60));

		expect(target.hasPointerCapture(4)).toBe(true);

		stop();
		stop();

		expect(end).toHaveBeenCalledOnce();
		expect(end).toHaveBeenCalledWith(
			expect.objectContaining({ position: { x: 40, y: 60 }, reason: "stopped" }),
			undefined,
		);
		expect(target.hasPointerCapture(4)).toBe(false);
		expect(target.listenerCount()).toBe(0);

		target.emit("pointerdown", createPointerEvent(5, 20, 30));
		expect(end).toHaveBeenCalledOnce();
	});

	test("supports already-aborted and active AbortSignals", (): void => {
		const { element, target } = setup();
		const alreadyAborted = new AbortController();
		const start = vi.fn();

		alreadyAborted.abort();
		observePointer(element, { start }, { signal: alreadyAborted.signal });
		expect(target.listenerCount()).toBe(0);

		const controller = new AbortController();
		const end = vi.fn();

		observePointer(element, { end }, { signal: controller.signal });
		target.emit("pointerdown", createPointerEvent(6, 20, 30));
		controller.abort();

		expect(end).toHaveBeenCalledWith(expect.objectContaining({ reason: "stopped" }), undefined);
		expect(target.hasPointerCapture(6)).toBe(false);
		expect(target.listenerCount()).toBe(0);
		expect(start).not.toHaveBeenCalled();
	});

	test("restores internal state after start and end handlers throw", (): void => {
		const { element, target } = setup();
		const startError = new Error("start");
		const endError = new Error("end");
		let starts = 0;
		let ends = 0;

		observePointer(element, {
			start() {
				if (++starts === 1) throw startError;
			},
			end() {
				if (++ends === 1) throw endError;
			},
		});

		expect(() => target.emit("pointerdown", createPointerEvent(1, 20, 30))).toThrow(startError);
		expect(() => target.emit("pointerdown", createPointerEvent(2, 20, 30))).not.toThrow();
		expect(() => target.emit("pointerup", createPointerEvent(2, 25, 35))).toThrow(endError);
		expect(() => target.emit("pointerdown", createPointerEvent(3, 20, 30))).not.toThrow();
		expect(starts).toBe(3);
	});

	test("uses zero ratios for zero-sized bounds", (): void => {
		const { element, target } = setup();
		const start = vi.fn();

		target.rect = createRect(10, 20, 0, 0);
		observePointer(element, { start });
		target.emit("pointerdown", createPointerEvent(1, 100, 200));

		expect(start).toHaveBeenCalledWith(expect.objectContaining({ ratio: { x: 0, y: 0 } }), expect.anything());
	});
});
