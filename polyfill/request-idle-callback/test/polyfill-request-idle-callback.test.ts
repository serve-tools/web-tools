import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestIdleCallbackDescriptor = Object.getOwnPropertyDescriptor(globalThis, "requestIdleCallback");
const cancelIdleCallbackDescriptor = Object.getOwnPropertyDescriptor(globalThis, "cancelIdleCallback");

const restore = (name: "requestIdleCallback" | "cancelIdleCallback", descriptor?: PropertyDescriptor) => {
	Reflect.deleteProperty(globalThis, name);

	if (descriptor) {
		Object.defineProperty(globalThis, name, descriptor);
	}
};

describe("requestIdleCallback polyfill", () => {
	beforeEach(() => {
		vi.resetModules();
		Reflect.deleteProperty(globalThis, "requestIdleCallback");
		Reflect.deleteProperty(globalThis, "cancelIdleCallback");
	});

	afterEach(() => {
		restore("requestIdleCallback", requestIdleCallbackDescriptor);
		restore("cancelIdleCallback", cancelIdleCallbackDescriptor);
	});

	it("installs both missing globals", async () => {
		await import("../src/polyfill-request-idle-callback.js");

		expect(globalThis.requestIdleCallback).toBeTypeOf("function");
		expect(globalThis.cancelIdleCallback).toBeTypeOf("function");
		expect(Object.getOwnPropertyDescriptor(globalThis, "requestIdleCallback")).toMatchObject({
			configurable: true,
			enumerable: false,
			writable: true,
		});
	});

	it("preserves existing native implementations", async () => {
		const nativeRequest = vi.fn(() => 1);
		const nativeCancel = vi.fn();

		Object.defineProperty(globalThis, "requestIdleCallback", {
			value: nativeRequest,
			configurable: true,
			writable: true,
		});
		Object.defineProperty(globalThis, "cancelIdleCallback", {
			value: nativeCancel,
			configurable: true,
			writable: true,
		});

		await import("../src/polyfill-request-idle-callback.js");

		expect(globalThis.requestIdleCallback).toBe(nativeRequest);
		expect(globalThis.cancelIdleCallback).toBe(nativeCancel);
	});

	it("supports selective global installation", async () => {
		await import("../src/lib/requestIdleCallback.js");

		expect(globalThis.requestIdleCallback).toBeTypeOf("function");
		expect("cancelIdleCallback" in globalThis).toBe(false);
	});

	it("supports fallback imports without global mutation", async () => {
		const requestModule = await import("../src/exports/requestIdleCallback.js");
		const cancelModule = await import("../src/exports/cancelIdleCallback.js");

		expect(requestModule.requestIdleCallback).toBeTypeOf("function");
		expect(cancelModule.cancelIdleCallback).toBeTypeOf("function");
		expect("requestIdleCallback" in globalThis).toBe(false);
		expect("cancelIdleCallback" in globalThis).toBe(false);
	});
});
