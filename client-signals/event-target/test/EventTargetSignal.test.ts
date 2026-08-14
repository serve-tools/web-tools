import { Signal } from "@serve-tools/signal";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { EventTargetSignal } from "../src/signal-event-target.js";

describe("EventTargetSignal", () => {
	it("reads initial state and exposes a read-only Computed signal", () => {
		const target = new EventTarget();
		const read = vi.fn(() => 1);
		const current = new EventTargetSignal(target, "change", read);

		expect(current.get()).toBe(1);
		expect(read).toHaveBeenCalledOnce();
		expect(current.active).toBe(true);
		expect(current.target).toBe(target);
		expect(current.type).toBe("change");
		expect(Signal.isComputed(current)).toBe(true);
		expect("set" in current).toBe(false);
		expectTypeOf(current.get()).toEqualTypeOf<number>();
		expectTypeOf(current).not.toHaveProperty("set");

		current.dispose();
	});

	it("rereads state after matching events and explicit refreshes", () => {
		const target = new EventTarget();
		let value = 1;
		const current = new EventTargetSignal(target, "change", () => value);

		value = 2;
		target.dispatchEvent(new Event("ignored"));
		expect(current.get()).toBe(1);

		target.dispatchEvent(new Event("change"));
		expect(current.get()).toBe(2);

		value = 3;
		current.refresh();
		expect(current.get()).toBe(3);

		current.dispose();
	});

	it("coalesces values through a custom equality function", () => {
		const target = new EventTarget();
		let value = { id: 1, label: "first" };
		const current = new EventTargetSignal(target, "change", () => value, {
			equals: (left, right) => left.id === right.id,
		});
		const watcher = new Signal.subtle.Watcher(vi.fn());

		watcher.watch(current);
		current.get();

		value = { id: 1, label: "second" };
		target.dispatchEvent(new Event("change"));
		expect(watcher.getPending()).toEqual([]);
		expect(current.get()).toEqual({ id: 1, label: "first" });

		value = { id: 2, label: "third" };
		target.dispatchEvent(new Event("change"));
		expect(watcher.getPending()).toEqual([current]);
		expect(current.get()).toEqual({ id: 2, label: "third" });

		watcher.unwatch(current);
		current.dispose();
	});

	it("gives every Signal independent ownership on a shared target", () => {
		const target = new EventTarget();
		let value = 1;
		const first = new EventTargetSignal(target, "change", () => `first:${value}`);
		const second = new EventTargetSignal(target, "change", () => `second:${value}`);

		first.dispose();
		value = 2;
		target.dispatchEvent(new Event("change"));

		expect(first.get()).toBe("first:1");
		expect(second.get()).toBe("second:2");
		expect(first.active).toBe(false);
		expect(second.active).toBe(true);

		second.dispose();
	});

	it("cannot affect a later observation after disposal", () => {
		const target = new EventTarget();
		let value = 1;
		const retired = new EventTargetSignal(target, "change", () => value);

		retired.dispose();

		const current = new EventTargetSignal(target, "change", () => value);
		retired.dispose();
		value = 2;
		target.dispatchEvent(new Event("change"));

		expect(current.get()).toBe(2);

		current.dispose();
	});

	it("supports intentional grouped cancellation with an external AbortSignal", () => {
		const target = new EventTarget();
		const controller = new AbortController();
		let value = 1;
		const first = new EventTargetSignal(target, "change", () => value, { signal: controller.signal });
		const second = new EventTargetSignal(target, "change", () => value, { signal: controller.signal });

		controller.abort();
		value = 2;
		target.dispatchEvent(new Event("change"));

		expect(first.active).toBe(false);
		expect(second.active).toBe(false);
		expect(first.get()).toBe(1);
		expect(second.get()).toBe(1);
	});

	it("initializes but does not observe with an already-aborted signal", () => {
		const target = new EventTarget();
		const controller = new AbortController();
		let value = 1;

		controller.abort();

		const current = new EventTargetSignal(target, "change", () => value, { signal: controller.signal });

		value = 2;
		target.dispatchEvent(new Event("change"));
		current.refresh();

		expect(current.active).toBe(false);
		expect(current.get()).toBe(1);
	});

	it("cleans up external cancellation when listener registration fails", () => {
		const target = new EventTarget();
		const controller = new AbortController();
		const removeAbortListener = vi.spyOn(controller.signal, "removeEventListener");
		const error = new Error("registration failed");

		vi.spyOn(target, "addEventListener").mockImplementation(() => {
			throw error;
		});

		expect(() => new EventTargetSignal(target, "change", () => 1, { signal: controller.signal })).toThrow(error);
		expect(removeAbortListener).toHaveBeenCalledOnce();
	});

	it("disposes idempotently through both disposal methods", () => {
		const target = new EventTarget();
		const removeEventListener = vi.spyOn(target, "removeEventListener");
		const current = new EventTargetSignal(target, "change", () => 1);

		current.dispose();
		current.dispose();
		current[Symbol.dispose]();

		expect(removeEventListener).toHaveBeenCalledOnce();
		expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
	});
});
