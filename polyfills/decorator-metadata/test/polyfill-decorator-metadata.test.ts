import { describe, expect, it, vi } from "vitest";

describe.sequential("decorator metadata polyfill", () => {
	it("exports the fallback without modifying a missing global", async () => {
		expect(Reflect.has(Symbol, "metadata")).toBe(false);

		const [{ metadata }, { metadata: fallback }] = await Promise.all([
			import("../src/exports/Symbol/metadata.js"),
			import("@serve-tools/ponyfill-decorator-metadata"),
		]);

		expect(metadata).toBe(fallback);
		expect(Reflect.has(Symbol, "metadata")).toBe(false);
	});

	it("selects and preserves an existing native symbol", async () => {
		const nativeMetadata = Symbol("native metadata");

		Object.defineProperty(Symbol, "metadata", {
			value: nativeMetadata,
			configurable: true,
		});
		vi.resetModules();

		const [{ metadata }] = await Promise.all([
			import("../src/exports/Symbol/metadata.js"),
			import("../src/apply/Symbol/metadata.js"),
		]);

		expect(metadata).toBe(nativeMetadata);
		expect(Reflect.get(Symbol, "metadata")).toBe(nativeMetadata);
		expect(Reflect.deleteProperty(Symbol, "metadata")).toBe(true);
	});

	it("selectively installs the fallback with well-known-symbol attributes", async () => {
		vi.resetModules();

		const [, { metadata: fallback }] = await Promise.all([
			import("../src/apply/Symbol/metadata.js"),
			import("@serve-tools/ponyfill-decorator-metadata"),
		]);

		expect(Symbol.metadata).toBe(fallback);
		expect(Object.getOwnPropertyDescriptor(Symbol, "metadata")).toEqual({
			value: fallback,
			configurable: false,
			enumerable: false,
			writable: false,
		});
	});

	it("the package root preserves the installed symbol", async () => {
		const installed = Symbol.metadata;

		vi.resetModules();
		await import("../src/polyfill-decorator-metadata.js");

		expect(Symbol.metadata).toBe(installed);
	});
});
