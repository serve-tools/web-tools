import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const disposableStackDescriptor = Object.getOwnPropertyDescriptor(globalThis, "DisposableStack");
const asyncDisposableStackDescriptor = Object.getOwnPropertyDescriptor(globalThis, "AsyncDisposableStack");
const suppressedErrorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "SuppressedError");

const restore = (
	name: "DisposableStack" | "AsyncDisposableStack" | "SuppressedError",
	descriptor?: PropertyDescriptor,
) => {
	Reflect.deleteProperty(globalThis, name);

	if (descriptor) {
		Object.defineProperty(globalThis, name, descriptor);
	}
};

describe("resource management polyfill", () => {
	beforeEach(() => {
		vi.resetModules();
		Reflect.deleteProperty(globalThis, "DisposableStack");
		Reflect.deleteProperty(globalThis, "AsyncDisposableStack");
		Reflect.deleteProperty(globalThis, "SuppressedError");
	});

	afterEach(() => {
		restore("DisposableStack", disposableStackDescriptor);
		restore("AsyncDisposableStack", asyncDisposableStackDescriptor);
		restore("SuppressedError", suppressedErrorDescriptor);
	});

	it("installs every missing global", async () => {
		await import("../src/polyfill-resource-management.js");

		expect(globalThis.DisposableStack).toBeTypeOf("function");
		expect(globalThis.AsyncDisposableStack).toBeTypeOf("function");
		expect(globalThis.SuppressedError).toBeTypeOf("function");
		expect(Symbol.dispose).toBeTypeOf("symbol");
		expect(Symbol.asyncDispose).toBeTypeOf("symbol");
		expect(Object.getOwnPropertyDescriptor(globalThis, "DisposableStack")).toMatchObject({
			configurable: true,
			enumerable: false,
			writable: true,
		});
	});

	it("preserves existing native implementations", async () => {
		class NativeDisposableStack {}
		class NativeAsyncDisposableStack {}
		class NativeSuppressedError extends Error {}
		const nativeDispose = Symbol.dispose;
		const nativeAsyncDispose = Symbol.asyncDispose;

		Object.defineProperty(globalThis, "DisposableStack", {
			value: NativeDisposableStack,
			configurable: true,
			writable: true,
		});
		Object.defineProperty(globalThis, "AsyncDisposableStack", {
			value: NativeAsyncDisposableStack,
			configurable: true,
			writable: true,
		});
		Object.defineProperty(globalThis, "SuppressedError", {
			value: NativeSuppressedError,
			configurable: true,
			writable: true,
		});

		await import("../src/polyfill-resource-management.js");

		expect(globalThis.DisposableStack).toBe(NativeDisposableStack);
		expect(globalThis.AsyncDisposableStack).toBe(NativeAsyncDisposableStack);
		expect(globalThis.SuppressedError).toBe(NativeSuppressedError);
		expect(Symbol.dispose).toBe(nativeDispose);
		expect(Symbol.asyncDispose).toBe(nativeAsyncDispose);
	});

	it("supports selective global installation", async () => {
		await import("../src/lib/SuppressedError.js");

		expect(globalThis.SuppressedError).toBeTypeOf("function");
		expect("DisposableStack" in globalThis).toBe(false);
		expect("AsyncDisposableStack" in globalThis).toBe(false);
	});

	it("supports fallback imports without global mutation", async () => {
		const [disposableStackModule, asyncDisposableStackModule, suppressedErrorModule] = await Promise.all([
			import("../src/exports/DisposableStack.js"),
			import("../src/exports/AsyncDisposableStack.js"),
			import("../src/exports/SuppressedError.js"),
		]);

		expect(disposableStackModule.DisposableStack).toBeTypeOf("function");
		expect(asyncDisposableStackModule.AsyncDisposableStack).toBeTypeOf("function");
		expect(suppressedErrorModule.SuppressedError).toBeTypeOf("function");
		expect("DisposableStack" in globalThis).toBe(false);
		expect("AsyncDisposableStack" in globalThis).toBe(false);
		expect("SuppressedError" in globalThis).toBe(false);
	});

	it("uses native Symbol.dispose when installing DisposableStack", async () => {
		await import("../src/lib/DisposableStack.js");

		const calls: string[] = [];
		const stack = new DisposableStack();
		stack.use({ [Symbol.dispose]: () => calls.push("disposed") });
		stack[Symbol.dispose]();

		expect(calls).toEqual(["disposed"]);
	});

	it("uses native disposal symbols when installing AsyncDisposableStack", async () => {
		await import("../src/lib/AsyncDisposableStack.js");

		const calls: string[] = [];
		const stack = new AsyncDisposableStack();
		stack.use({ [Symbol.asyncDispose]: async () => void calls.push("disposed") });
		await stack[Symbol.asyncDispose]();

		expect(calls).toEqual(["disposed"]);
	});

	it("uses the selected symbol without installing DisposableStack", async () => {
		const [stackModule, symbolModule] = await Promise.all([
			import("../src/exports/DisposableStack.js"),
			import("../src/exports/Symbol/dispose.js"),
		]);
		const calls: string[] = [];
		const stack = new stackModule.DisposableStack();
		stack.use({ [symbolModule.dispose]: () => calls.push("disposed") });
		stack[symbolModule.dispose]();

		expect(calls).toEqual(["disposed"]);
		expect(globalThis.DisposableStack).toBeUndefined();
	});

	it("uses the selected symbols without installing AsyncDisposableStack", async () => {
		const [stackModule, symbolModule] = await Promise.all([
			import("../src/exports/AsyncDisposableStack.js"),
			import("../src/exports/Symbol/asyncDispose.js"),
		]);
		const calls: string[] = [];
		const stack = new stackModule.AsyncDisposableStack();
		stack.use({ [symbolModule.asyncDispose]: async () => void calls.push("disposed") });
		await stack[symbolModule.asyncDispose]();

		expect(calls).toEqual(["disposed"]);
		expect(globalThis.AsyncDisposableStack).toBeUndefined();
	});
});
