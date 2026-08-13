import { describe, expect, it } from "vitest";
import { enqueueMicrotask } from "../src/lib/scheduler.js";

const task = (run: () => void) => ({ run });

describe("scheduler", () => {
	it("flushes every callback before reporting errors", () => {
		const error = new Error("expected");
		const calls: number[] = [];
		const queuedMicrotasks: VoidFunction[] = [];
		const queueMicrotask = globalThis.queueMicrotask;

		globalThis.queueMicrotask = (callback) => queuedMicrotasks.push(callback);

		try {
			enqueueMicrotask(
				task(() => {
					calls.push(1);

					throw error;
				}),
			);
			enqueueMicrotask(task(() => calls.push(2)));
		} finally {
			globalThis.queueMicrotask = queueMicrotask;
		}

		expect(queuedMicrotasks).toHaveLength(1);
		expect(() => queuedMicrotasks[0]!()).toThrow(error);
		expect(calls).toEqual([1, 2]);
	});

	it("defers callbacks enqueued during a flush to another microtask", () => {
		const calls: number[] = [];
		const queuedMicrotasks: VoidFunction[] = [];
		const queueMicrotask = globalThis.queueMicrotask;

		globalThis.queueMicrotask = (callback) => queuedMicrotasks.push(callback);

		try {
			enqueueMicrotask(
				task(() => {
					calls.push(1);
					enqueueMicrotask(task(() => calls.push(2)));
				}),
			);

			queuedMicrotasks[0]!();

			expect(calls).toEqual([1]);
			expect(queuedMicrotasks).toHaveLength(2);

			queuedMicrotasks[1]!();
		} finally {
			globalThis.queueMicrotask = queueMicrotask;
		}

		expect(calls).toEqual([1, 2]);
	});
});
