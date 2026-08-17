import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reportErrorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "reportError");

const restore = () => {
	Reflect.deleteProperty(globalThis, "reportError");

	if (reportErrorDescriptor) {
		Object.defineProperty(globalThis, "reportError", reportErrorDescriptor);
	}
};

describe("reportError polyfill", () => {
	beforeEach(() => {
		vi.resetModules();
		Reflect.deleteProperty(globalThis, "reportError");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		restore();
	});

	it("exports the native function without modifying the global", async () => {
		const nativeReportError = vi.fn(function (this: typeof globalThis) {
			expect(this).toBe(globalThis);
		});

		Object.defineProperty(globalThis, "reportError", {
			value: nativeReportError,
			configurable: true,
			writable: true,
		});

		const { reportError } = await import("../src/polyfill-report-error.js");
		reportError("failure");

		expect(nativeReportError).toHaveBeenCalledExactlyOnceWith("failure");
		expect(Reflect.get(globalThis, "reportError")).toBe(nativeReportError);
	});

	it("exports the ponyfill without modifying a missing global", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { reportError } = await import("../src/polyfill-report-error.js");

		reportError("failure");

		expect(consoleError).toHaveBeenCalledExactlyOnceWith("failure");
		expect(Reflect.has(globalThis, "reportError")).toBe(false);
	});

	it("apply installs the ponyfill when the global is missing", async () => {
		await import("../src/apply/index.js");

		expect(Reflect.get(globalThis, "reportError")).toBeTypeOf("function");
		expect(Object.getOwnPropertyDescriptor(globalThis, "reportError")).toMatchObject({
			configurable: true,
			enumerable: false,
			writable: true,
		});
	});

	it("apply preserves the native global", async () => {
		const nativeReportError = vi.fn();

		Object.defineProperty(globalThis, "reportError", {
			value: nativeReportError,
			configurable: true,
			writable: true,
		});

		await import("../src/apply/index.js");

		expect(Reflect.get(globalThis, "reportError")).toBe(nativeReportError);
	});
});
