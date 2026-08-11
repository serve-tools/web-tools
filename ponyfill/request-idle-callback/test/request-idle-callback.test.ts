/// <reference lib="dom" />

import { afterEach, describe, expect, it, vi } from "vitest";

import { cancelIdleCallback, requestIdleCallback } from "../src/ponyfill-request-idle-callback.js";

afterEach(() => vi.unstubAllGlobals());

describe("requestIdleCallback", () => {
	it("does not install global functions", () => {
		expect(globalThis.requestIdleCallback).not.toBe(requestIdleCallback);
		expect(globalThis.cancelIdleCallback).not.toBe(cancelIdleCallback);
	});

	it("calls the callback with an idle deadline", async () => {
		const callback = vi.fn();
		requestIdleCallback(callback);

		await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce());

		const deadline = callback.mock.calls[0]![0];
		expect(deadline.didTimeout).toBe(false);
		expect(deadline.timeRemaining()).toBeGreaterThanOrEqual(0);
		expect(deadline.timeRemaining()).toBeLessThanOrEqual(50);
	});

	it("runs callbacks in registration order", async () => {
		const order: number[] = [];

		requestIdleCallback(() => order.push(1));
		requestIdleCallback(() => order.push(2));
		requestIdleCallback(() => order.push(3));

		await vi.waitFor(() => expect(order).toEqual([1, 2, 3]));
	});

	it("defers callbacks registered during an idle callback", async () => {
		let now = 0;
		const remaining: number[] = [];

		vi.stubGlobal("performance", { now: () => now });

		requestIdleCallback(() => {
			now = 10;

			requestIdleCallback((deadline) => remaining.push(deadline.timeRemaining()));
		});

		await vi.waitFor(() => expect(remaining).toEqual([50]));
	});

	it("runs a callback when its timeout elapses", async () => {
		vi.stubGlobal("requestAnimationFrame", () => 1);
		const callback = vi.fn();

		requestIdleCallback(callback, { timeout: 1 });

		await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce());
		expect(callback.mock.calls[0]![0].didTimeout).toBe(true);
		expect(callback.mock.calls[0]![0].timeRemaining()).toBe(0);
	});

	it("continues scheduling after the previous callback times out before its frame", async () => {
		const timedOutCallback = vi.fn();
		const idleCallback = vi.fn();

		vi.stubGlobal("requestAnimationFrame", () => 1);
		requestIdleCallback(timedOutCallback, { timeout: 1 });
		await vi.waitFor(() => expect(timedOutCallback).toHaveBeenCalledOnce());

		vi.unstubAllGlobals();
		requestIdleCallback(idleCallback, { timeout: 0 });
		await vi.waitFor(() => expect(idleCallback).toHaveBeenCalledOnce());

		expect(idleCallback.mock.calls[0]![0].didTimeout).toBe(false);
	});
});

describe("cancelIdleCallback", () => {
	it("prevents idle and timeout delivery", async () => {
		const callback = vi.fn();
		const handle = requestIdleCallback(callback, { timeout: 10 });

		cancelIdleCallback(handle);
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(callback).not.toHaveBeenCalled();
	});

	it("ignores unknown handles", () => {
		expect(() => cancelIdleCallback(Number.MAX_SAFE_INTEGER)).not.toThrow();
	});

	it("continues scheduling after the previous callback is cancelled before its frame", async () => {
		vi.stubGlobal("requestAnimationFrame", () => 1);

		const cancelledHandle = requestIdleCallback(() => {});
		cancelIdleCallback(cancelledHandle);

		vi.unstubAllGlobals();
		const callback = vi.fn();
		requestIdleCallback(callback);

		await vi.waitFor(() => expect(callback).toHaveBeenCalledOnce());
	});
});
