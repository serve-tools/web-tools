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

	it("installs the ponyfill when the global is missing", async () => {
		await import("../src/polyfill-report-error.js");

		const { reportError: ponyfill } = await import("@serve-tools/ponyfill-report-error");

		expect(globalThis.reportError).toBe(ponyfill);
	});

	it("preserves the global assignment property descriptor", async () => {
		await import("../src/polyfill-report-error.js");

		expect(Object.getOwnPropertyDescriptor(globalThis, "reportError")).toMatchObject({
			configurable: true,
			enumerable: true,
			writable: true,
		});
	});

	it("preserves an existing native function", async () => {
		const nativeReportError = vi.fn();

		Object.defineProperty(globalThis, "reportError", {
			value: nativeReportError,
			configurable: true,
			writable: true,
		});

		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "reportError");

		await import("../src/polyfill-report-error.js");

		expect(globalThis.reportError).toBe(nativeReportError);
		expect(Object.getOwnPropertyDescriptor(globalThis, "reportError")).toEqual(descriptor);
	});

	it("replaces an explicitly undefined global", async () => {
		Object.defineProperty(globalThis, "reportError", {
			value: undefined,
			configurable: true,
			writable: true,
		});

		await import("../src/polyfill-report-error.js");

		const { reportError: ponyfill } = await import("@serve-tools/ponyfill-report-error");

		expect(globalThis.reportError).toBe(ponyfill);
	});

	it("replaces an explicitly null global", async () => {
		Object.defineProperty(globalThis, "reportError", {
			value: null,
			configurable: true,
			writable: true,
		});

		await import("../src/polyfill-report-error.js");

		const { reportError: ponyfill } = await import("@serve-tools/ponyfill-report-error");

		expect(globalThis.reportError).toBe(ponyfill);
	});

	it("supports selective global installation", async () => {
		await import("../src/apply/reportError.js");

		const { reportError: ponyfill } = await import("@serve-tools/ponyfill-report-error");

		expect(globalThis.reportError).toBe(ponyfill);
	});

	it("supports fallback imports without global mutation", async () => {
		const { reportError } = await import("../src/exports/reportError.js");
		const { reportError: ponyfill } = await import("@serve-tools/ponyfill-report-error");

		expect(reportError).toBe(ponyfill);
		expect(Reflect.has(globalThis, "reportError")).toBe(false);
	});

	it("exports an existing native function without modifying the global", async () => {
		const nativeReportError = vi.fn();

		Object.defineProperty(globalThis, "reportError", {
			value: nativeReportError,
			configurable: true,
			writable: true,
		});

		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "reportError");
		const { reportError } = await import("../src/exports/reportError.js");

		reportError("failure");

		expect(nativeReportError).toHaveBeenCalledExactlyOnceWith("failure");
		expect(reportError).toBe(nativeReportError);
		expect(globalThis.reportError).toBe(nativeReportError);
		expect(Object.getOwnPropertyDescriptor(globalThis, "reportError")).toEqual(descriptor);
	});

	it("reports errors through the fallback without modifying a missing global", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { reportError } = await import("../src/exports/reportError.js");

		reportError("failure");

		expect(consoleError).toHaveBeenCalledExactlyOnceWith("failure");
		expect(Reflect.has(globalThis, "reportError")).toBe(false);
	});
});
