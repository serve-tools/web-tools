import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nativeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Composite");

const restore = () => {
	Reflect.deleteProperty(globalThis, "Composite");

	if (nativeDescriptor) {
		Object.defineProperty(globalThis, "Composite", nativeDescriptor);
	}
};

describe("Composite polyfill", () => {
	beforeEach(() => {
		vi.resetModules();
		Reflect.deleteProperty(globalThis, "Composite");
	});

	afterEach(restore);

	it("installs the ponyfill when Composite is missing", async () => {
		await import("../src/polyfill-composites.js");

		const { Composite: ponyfill } = await import("@serve-tools/ponyfill-composites");
		const first = globalThis.Composite({ x: 1, y: 2 });
		const second = globalThis.Composite({ y: 2, x: 1 });

		expect(globalThis.Composite).toBe(ponyfill);
		expect(first).toBe(second);
		expect(globalThis.Composite.isComposite(first)).toBe(true);
	});

	it("installs a writable, configurable, non-enumerable property", async () => {
		await import("../src/polyfill-composites.js");

		expect(Object.getOwnPropertyDescriptor(globalThis, "Composite")).toMatchObject({
			configurable: true,
			enumerable: false,
			writable: true,
		});
	});

	it("preserves an existing native function and descriptor", async () => {
		function NativeComposite() {}

		Object.defineProperty(globalThis, "Composite", { value: NativeComposite, configurable: true });

		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Composite");

		await import("../src/polyfill-composites.js");

		expect(Reflect.get(globalThis, "Composite")).toBe(NativeComposite);
		expect(Object.getOwnPropertyDescriptor(globalThis, "Composite")).toEqual(descriptor);
	});

	it("replaces an explicitly undefined global", async () => {
		Object.defineProperty(globalThis, "Composite", {
			value: undefined,
			configurable: true,
			writable: true,
		});

		await import("../src/apply/Composite.js");

		expect(globalThis.Composite).toBeTypeOf("function");
		expect(Object.getOwnPropertyDescriptor(globalThis, "Composite")).toMatchObject({
			configurable: true,
			enumerable: false,
			writable: true,
		});
	});

	it("is idempotent across repeated module evaluation", async () => {
		await import("../src/polyfill-composites.js");

		const value = globalThis.Composite;
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Composite");

		vi.resetModules();
		await import("../src/polyfill-composites.js");

		expect(globalThis.Composite).toBe(value);
		expect(Object.getOwnPropertyDescriptor(globalThis, "Composite")).toEqual(descriptor);
	});

	it("supports fallback imports without global mutation", async () => {
		const { Composite } = await import("../src/exports/Composite.js");
		const { Composite: ponyfill } = await import("@serve-tools/ponyfill-composites");

		expect(Composite).toBe(ponyfill);
		expect(Reflect.has(globalThis, "Composite")).toBe(false);
		expect(Composite({ key: "value" })).toBe(Composite({ key: "value" }));
	});

	it("exports an existing native function by exact identity without mutation", async () => {
		function NativeComposite() {}

		Object.defineProperty(globalThis, "Composite", { value: NativeComposite, configurable: true });

		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Composite");
		const { Composite } = await import("../src/exports/Composite.js");

		expect(Composite).toBe(NativeComposite);
		expect(Object.getOwnPropertyDescriptor(globalThis, "Composite")).toEqual(descriptor);
	});
});
