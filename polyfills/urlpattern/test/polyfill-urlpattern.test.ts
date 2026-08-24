import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nativeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "URLPattern");

const restore = () => {
	Reflect.deleteProperty(globalThis, "URLPattern");

	if (nativeDescriptor) {
		Object.defineProperty(globalThis, "URLPattern", nativeDescriptor);
	}
};

describe("URLPattern polyfill", () => {
	beforeEach(() => {
		vi.resetModules();

		Reflect.deleteProperty(globalThis, "URLPattern");
	});

	afterEach(() => {
		vi.restoreAllMocks();

		restore();
	});

	it("installs the ponyfill when the global is missing", async () => {
		await import("../src/polyfill-urlpattern.js");

		const { URLPattern: ponyfill } = await import("@serve-tools/ponyfill-urlpattern");

		expect(globalThis.URLPattern).toBe(ponyfill);
	});

	it("matches the native global property descriptor", async () => {
		await import("../src/polyfill-urlpattern.js");

		expect(Object.getOwnPropertyDescriptor(globalThis, "URLPattern")).toMatchObject({
			configurable: true,
			enumerable: false,
			writable: true,
		});
	});

	it("preserves an existing native constructor", async () => {
		class NativeURLPattern {}

		Object.defineProperty(globalThis, "URLPattern", {
			value: NativeURLPattern,
			configurable: true,
			writable: true,
		});

		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "URLPattern");

		await import("../src/polyfill-urlpattern.js");

		expect(globalThis.URLPattern).toBe(NativeURLPattern);
		expect(Object.getOwnPropertyDescriptor(globalThis, "URLPattern")).toEqual(descriptor);
	});

	it("replaces an explicitly undefined global", async () => {
		Object.defineProperty(globalThis, "URLPattern", {
			value: undefined,
			configurable: true,
			writable: true,
		});

		await import("../src/polyfill-urlpattern.js");

		const { URLPattern: ponyfill } = await import("@serve-tools/ponyfill-urlpattern");

		expect(globalThis.URLPattern).toBe(ponyfill);
	});

	it("replaces an explicitly null global", async () => {
		Object.defineProperty(globalThis, "URLPattern", {
			value: null,
			configurable: true,
			writable: true,
		});

		await import("../src/polyfill-urlpattern.js");

		const { URLPattern: ponyfill } = await import("@serve-tools/ponyfill-urlpattern");

		expect(globalThis.URLPattern).toBe(ponyfill);
		expect(Object.getOwnPropertyDescriptor(globalThis, "URLPattern")).toMatchObject({
			configurable: true,
			enumerable: false,
			writable: true,
		});
	});

	it("supports selective global installation", async () => {
		await import("../src/apply/URLPattern.js");

		const { URLPattern: ponyfill } = await import("@serve-tools/ponyfill-urlpattern");

		expect(globalThis.URLPattern).toBe(ponyfill);
	});

	it("supports fallback imports without global mutation", async () => {
		const { URLPattern } = await import("../src/exports/URLPattern.js");
		const { URLPattern: ponyfill } = await import("@serve-tools/ponyfill-urlpattern");

		expect(URLPattern).toBe(ponyfill);
		expect(Reflect.has(globalThis, "URLPattern")).toBe(false);
	});

	it("exports an existing native constructor without modifying the global", async () => {
		class NativeURLPattern {}

		Object.defineProperty(globalThis, "URLPattern", {
			value: NativeURLPattern,
			configurable: true,
			writable: true,
		});

		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "URLPattern");
		const { URLPattern } = await import("../src/exports/URLPattern.js");

		expect(URLPattern).toBe(NativeURLPattern);
		expect(globalThis.URLPattern).toBe(NativeURLPattern);
		expect(Object.getOwnPropertyDescriptor(globalThis, "URLPattern")).toEqual(descriptor);
	});

	it("matches URLs and exposes named captures through the installed global", async () => {
		await import("../src/polyfill-urlpattern.js");

		const pattern = new globalThis.URLPattern({ pathname: "/books/:id" });
		const result = pattern.exec("https://example.com/books/42");

		expect(pattern.test("https://example.com/books/42")).toBe(true);
		expect(result?.pathname.groups.id).toBe("42");
	});
});
