import { describe, expect, it } from "vitest";
import {
	AsyncDisposableStack,
	asyncDispose,
	DisposableStack,
	dispose,
	SuppressedError,
} from "../src/ponyfill-resource-management.js";

describe("ponyfill boundary", () => {
	it("does not install or replace native globals", () => {
		expect(Reflect.get(globalThis, "DisposableStack")).not.toBe(DisposableStack);
		expect(Reflect.get(globalThis, "AsyncDisposableStack")).not.toBe(AsyncDisposableStack);
		expect(Reflect.get(globalThis, "SuppressedError")).not.toBe(SuppressedError);
		expect(Reflect.get(Symbol, "dispose")).not.toBe(dispose);
		expect(Reflect.get(Symbol, "asyncDispose")).not.toBe(asyncDispose);
	});
});

describe("symbols", () => {
	it("exports stable, non-registry symbols", () => {
		expect(dispose.description).toBe("Symbol.dispose");
		expect(asyncDispose.description).toBe("Symbol.asyncDispose");
		expect(Symbol.keyFor(dispose)).toBeUndefined();
		expect(Symbol.keyFor(asyncDispose)).toBeUndefined();
	});
});

describe("SuppressedError", () => {
	it("creates an error with error and suppressed properties", () => {
		const error1 = new Error("first");
		const error2 = new Error("second");
		const suppressed = new SuppressedError(error1, error2);

		expect(suppressed).toBeInstanceOf(Error);
		expect(suppressed.name).toBe("SuppressedError");
		expect(suppressed.error).toBe(error1);
		expect(suppressed.suppressed).toBe(error2);
	});

	it("accepts an optional message", () => {
		const suppressed = new SuppressedError("err1", "err2", "custom message");
		expect(suppressed.message).toBe("custom message");
	});
});

describe("DisposableStack", () => {
	it("creates a new stack", () => {
		const stack = new DisposableStack();
		expect(stack).toBeInstanceOf(DisposableStack);
		expect(stack.disposed).toBe(false);
	});

	it("disposes resources in reverse order", () => {
		const stack = new DisposableStack();
		const order: number[] = [];

		stack.defer(() => order.push(1));
		stack.defer(() => order.push(2));
		stack.defer(() => order.push(3));

		stack.dispose();

		expect(order).toEqual([3, 2, 1]);
		expect(stack.disposed).toBe(true);
	});

	it("use() adds disposable resources", () => {
		const stack = new DisposableStack();
		const disposed: boolean[] = [];

		const resource = {
			[dispose]() {
				disposed.push(true);
			},
		};

		stack.use(resource);
		stack.dispose();

		expect(disposed).toEqual([true]);
	});

	it("captures and validates the dispose method when used", () => {
		const calls: string[] = [];
		const resource = { [dispose]: () => calls.push("original") };
		const stack = new DisposableStack();

		stack.use(resource);
		resource[dispose] = () => calls.push("replacement");
		stack.dispose();

		expect(calls).toEqual(["original"]);
		expect(() => new DisposableStack().use({ [dispose]: 1 } as never)).toThrow(TypeError);
		expect(() => new DisposableStack().use({} as never)).toThrow(TypeError);
	});

	it("use() handles null and undefined", () => {
		const stack = new DisposableStack();
		expect(stack.use(null)).toBe(null);
		expect(stack.use(undefined)).toBe(undefined);
		stack.dispose();
	});

	it("adopt() adds non-disposable resources with callback", () => {
		const stack = new DisposableStack();
		const disposed: string[] = [];

		const resource = { name: "test" };
		stack.adopt(resource, (r) => disposed.push(r.name));
		stack.dispose();

		expect(disposed).toEqual(["test"]);
	});

	it("move() transfers resources to new stack", () => {
		const stack1 = new DisposableStack();
		const order: number[] = [];

		stack1.defer(() => order.push(1));
		stack1.defer(() => order.push(2));

		const stack2 = stack1.move();

		expect(stack1.disposed).toBe(true);
		expect(stack2.disposed).toBe(false);

		stack2.dispose();
		expect(order).toEqual([2, 1]);
	});

	it("throws ReferenceError when using disposed stack", () => {
		const stack = new DisposableStack();
		stack.dispose();

		expect(() => stack.use(null)).toThrow(ReferenceError);
		expect(() => stack.adopt({}, () => {})).toThrow(ReferenceError);
		expect(() => stack.defer(() => {})).toThrow(ReferenceError);
		expect(() => stack.move()).toThrow(ReferenceError);
	});

	it("collects multiple errors with SuppressedError", () => {
		const stack = new DisposableStack();
		const error1 = new Error("first");
		const error2 = new Error("second");

		stack.defer(() => {
			throw error1;
		});
		stack.defer(() => {
			throw error2;
		});

		let thrown: unknown;
		try {
			stack.dispose();
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(SuppressedError);
		expect((thrown as SuppressedError).error).toBe(error1);
		expect((thrown as SuppressedError).suppressed).toBe(error2);
	});

	it("has Symbol.toStringTag", () => {
		const stack = new DisposableStack();
		expect(Object.prototype.toString.call(stack)).toBe("[object DisposableStack]");
	});
});

describe("AsyncDisposableStack", () => {
	it("creates a new async stack", () => {
		const stack = new AsyncDisposableStack();
		expect(stack).toBeInstanceOf(AsyncDisposableStack);
		expect(stack.disposed).toBe(false);
	});

	it("disposes resources in reverse order", async () => {
		const stack = new AsyncDisposableStack();
		const order: number[] = [];

		stack.defer(async () => void order.push(1));
		stack.defer(async () => void order.push(2));
		stack.defer(async () => void order.push(3));

		await stack.disposeAsync();

		expect(order).toEqual([3, 2, 1]);
		expect(stack.disposed).toBe(true);
	});

	it("use() adds async disposable resources", async () => {
		const stack = new AsyncDisposableStack();
		const disposed: boolean[] = [];

		const resource = {
			async [asyncDispose]() {
				disposed.push(true);
			},
		};

		stack.use(resource);
		await stack.disposeAsync();

		expect(disposed).toEqual([true]);
	});

	it("use() handles sync disposable resources", async () => {
		const stack = new AsyncDisposableStack();
		const disposed: boolean[] = [];

		const resource = {
			[dispose]() {
				disposed.push(true);
			},
		};

		stack.use(resource);
		await stack.disposeAsync();

		expect(disposed).toEqual([true]);
	});

	it("prefers and captures the async dispose method when used", async () => {
		const calls: string[] = [];
		const resource = {
			[asyncDispose]: async () => void calls.push("async"),
			[dispose]: () => calls.push("sync"),
		};
		const stack = new AsyncDisposableStack();

		stack.use(resource);
		resource[asyncDispose] = async () => void calls.push("replacement");
		await stack.disposeAsync();

		expect(calls).toEqual(["async"]);
		expect(() => new AsyncDisposableStack().use({ [asyncDispose]: 1 } as never)).toThrow(TypeError);
		expect(() => new AsyncDisposableStack().use({} as never)).toThrow(TypeError);
	});

	it("adopt() adds non-disposable resources with async callback", async () => {
		const stack = new AsyncDisposableStack();
		const disposed: string[] = [];

		const resource = { name: "test" };
		stack.adopt(resource, async (r) => void disposed.push(r.name));
		await stack.disposeAsync();

		expect(disposed).toEqual(["test"]);
	});

	it("move() transfers resources to new stack", async () => {
		const stack1 = new AsyncDisposableStack();
		const order: number[] = [];

		stack1.defer(async () => void order.push(1));
		stack1.defer(async () => void order.push(2));

		const stack2 = stack1.move();

		expect(stack1.disposed).toBe(true);
		expect(stack2.disposed).toBe(false);

		await stack2.disposeAsync();
		expect(order).toEqual([2, 1]);
	});

	it("throws ReferenceError when using disposed stack", async () => {
		const stack = new AsyncDisposableStack();
		await stack.disposeAsync();

		expect(() => stack.use(null)).toThrow(ReferenceError);
		expect(() => stack.adopt({}, async () => {})).toThrow(ReferenceError);
		expect(() => stack.defer(async () => {})).toThrow(ReferenceError);
		expect(() => stack.move()).toThrow(ReferenceError);
	});

	it("collects multiple errors with SuppressedError", async () => {
		const stack = new AsyncDisposableStack();
		const error1 = new Error("first");
		const error2 = new Error("second");

		stack.defer(async () => {
			throw error1;
		});
		stack.defer(async () => {
			throw error2;
		});

		let thrown: unknown;
		try {
			await stack.disposeAsync();
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(SuppressedError);
		expect((thrown as SuppressedError).error).toBe(error1);
		expect((thrown as SuppressedError).suppressed).toBe(error2);
	});

	it("has Symbol.toStringTag", () => {
		const stack = new AsyncDisposableStack();
		expect(Object.prototype.toString.call(stack)).toBe("[object AsyncDisposableStack]");
	});
});
