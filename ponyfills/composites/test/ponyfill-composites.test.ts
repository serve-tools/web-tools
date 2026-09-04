import { describe, expect, it } from "vitest";
import { Composite } from "../src/ponyfill-composites.js";

describe("Composite", () => {
	it("creates frozen null-prototype objects with canonical property order", () => {
		const composite = Composite({ x: true, 10: true, 2: true, a: true });

		expect(Object.getPrototypeOf(composite)).toBeNull();
		expect(Object.isFrozen(composite)).toBe(true);
		expect(Object.keys(composite)).toEqual(["2", "10", "a", "x"]);
		expect(Object.getOwnPropertyDescriptor(composite, "x")).toEqual({
			configurable: false,
			enumerable: true,
			value: true,
			writable: false,
		});
	});

	it("interns the same canonical key-value pairs", () => {
		const object = {};

		expect(Composite({ a: 1, b: 2 })).toBe(Composite({ b: 2, a: 1 }));
		expect(Composite({ value: Number.NaN })).toBe(Composite({ value: Number.NaN }));
		expect(Composite({ value: object })).toBe(Composite({ value: object }));
		expect(Composite({ value: {} })).not.toBe(Composite({ value: {} }));
		expect(Composite({ a: 1 })).not.toBe(Composite({ a: 1, b: undefined }));
	});

	it("normalizes negative zero unless preservation is requested", () => {
		const zero = Composite({ value: 0 });
		const normalized = Composite({ value: -0 });
		const preserved = Composite({ value: -0 }, { preserveNegativeZero: true });

		expect(normalized).toBe(zero);
		expect(Object.is(normalized.value, 0)).toBe(true);
		expect(preserved).not.toBe(zero);
		expect(Object.is(preserved.value, -0)).toBe(true);
		expect(Composite(preserved)).toBe(preserved);
	});

	it("canonicalizes observable NaN payload bits", () => {
		const view = new DataView(new ArrayBuffer(8));
		const bitsOf = (value: number) => {
			view.setFloat64(0, value);

			return view.getBigUint64(0);
		};
		const canonicalBits = bitsOf(Number.NaN);
		const candidateBits = 0x7ff8_0000_0000_0001n;
		const payloadBits = candidateBits === canonicalBits ? 0x7ff8_0000_0000_0002n : candidateBits;
		view.setBigUint64(0, payloadBits);

		const payloadNaN = view.getFloat64(0);
		const composite = Composite({ payloadNaN });

		expect(Number.isNaN(composite.payloadNaN)).toBe(true);
		expect(bitsOf(composite.payloadNaN)).toBe(canonicalBits);
	});

	it("reads options once before snapshotting source properties", () => {
		const operations: string[] = [];
		const source = new Proxy(
			{
				get first() {
					operations.push("get first");

					return 1;
				},
				get second() {
					operations.push("get second");

					return 2;
				},
			},
			{
				ownKeys(target) {
					operations.push("own keys");

					return Reflect.ownKeys(target);
				},
				getOwnPropertyDescriptor(target, key) {
					operations.push(`describe ${String(key)}`);

					return Reflect.getOwnPropertyDescriptor(target, key);
				},
			},
		);
		const options = {
			get preserveNegativeZero() {
				operations.push("get option");

				return false;
			},
		};

		Composite(source, options);

		expect(operations).toEqual([
			"get option",
			"own keys",
			"describe first",
			"get first",
			"describe second",
			"get second",
		]);
	});

	it("uses only own enumerable string properties and reads getters once", () => {
		let calls = 0;
		const inherited = { inherited: 1 };
		const source = Object.create(inherited) as { visible?: number; hidden?: number };
		Object.defineProperty(source, "hidden", { enumerable: false, value: 2 });
		Object.defineProperty(source, "visible", {
			enumerable: true,
			get() {
				++calls;

				return 3;
			},
		});

		const composite = Composite(source);

		expect(composite).toEqual({ visible: 3 });
		expect(calls).toBe(1);
		expect("inherited" in composite).toBe(false);
		expect("hidden" in composite).toBe(false);
	});

	it("does not observe intrinsic replacement by source getters", () => {
		const existing = Composite({ a: 1, b: 2 });
		const replacements: [object, PropertyKey, unknown][] = [
			[Object, "create", () => ({})],
			[Object, "freeze", (value: object) => value],
			[Object, "getOwnPropertyDescriptor", () => undefined],
			[Object, "is", () => true],
			[Reflect, "get", () => "corrupted"],
			[
				Array.prototype,
				"sort",
				function (this: unknown[]) {
					return this;
				},
			],
			[WeakMap.prototype, "get", () => undefined],
			[
				WeakMap.prototype,
				"set",
				() => {
					throw new Error("corrupted WeakMap.set");
				},
			],
			[
				WeakSet.prototype,
				"add",
				() => {
					throw new Error("corrupted WeakSet.add");
				},
			],
			[WeakRef.prototype, "deref", () => undefined],
			[globalThis, "WeakRef", class CorruptedWeakRef {}],
		];
		const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
		const defineProperty = Object.defineProperty;
		const descriptors = replacements.map(([target, key]) => getOwnPropertyDescriptor(target, key)!);
		let composite: ReturnType<typeof Composite> | undefined;

		try {
			composite = Composite({
				get b() {
					for (const [target, key, value] of replacements) {
						defineProperty(target, key, { configurable: true, writable: true, value });
					}

					return 3;
				},
				a: 1,
			});
		} finally {
			for (let index = 0; index < replacements.length; ++index) {
				const [target, key] = replacements[index]!;
				defineProperty(target, key, descriptors[index]!);
			}
		}

		expect(composite).not.toBe(existing);
		expect(composite).toEqual({ a: 1, b: 3 });
		expect(Object.keys(composite!)).toEqual(["a", "b"]);
		expect(Object.getPrototypeOf(composite)).toBeNull();
		expect(Object.isFrozen(composite)).toBe(true);
		expect(Composite({ b: 3, a: 1 })).toBe(composite);
	});

	it("rejects enumerable symbol keys but ignores non-enumerable ones", () => {
		const symbol = Symbol("key");
		const enumerableSource = { [symbol]: 1 };
		const hiddenSource = Object.defineProperty({}, symbol, { enumerable: false, value: 1 });

		expect(() => Composite(enumerableSource)).toThrow(TypeError);
		expect(Composite(hiddenSource)).toBe(Composite({}));
	});

	it("accepts callable objects and rejects primitives", () => {
		const source = Object.assign(() => undefined, { value: 1 });

		expect(Composite(source).value).toBe(1);
		expect(() => Composite(null as never)).toThrow(TypeError);
		expect(() => Composite(1 as never)).toThrow(TypeError);
	});

	it("returns an existing composite before observing options", () => {
		const composite = Composite({ value: -0 }, { preserveNegativeZero: true });

		expect(Composite(composite, null as never)).toBe(composite);
	});

	it("identifies only direct products of this Composite function", () => {
		const composite = Composite({ value: 1 });

		expect(Composite.isComposite(composite)).toBe(true);
		expect(Composite.isComposite(new Proxy(composite, {}))).toBe(false);
		expect(Composite.isComposite({ value: 1 })).toBe(false);
		expect(Composite.isComposite(null)).toBe(false);
	});

	it("is callable but not constructible and does not modify the global object", () => {
		expect(Composite).toHaveProperty("name", "Composite");
		expect(Composite).toHaveProperty("length", 1);
		expect(Composite.isComposite).toHaveProperty("name", "isComposite");
		expect(Composite.isComposite).toHaveProperty("length", 1);
		expect(Object.hasOwn(Composite, "prototype")).toBe(false);
		expect(() => Reflect.construct(Composite as Function, [{}])).toThrow(TypeError);
		expect(Reflect.get(globalThis, "Composite")).toBeUndefined();
	});
});
