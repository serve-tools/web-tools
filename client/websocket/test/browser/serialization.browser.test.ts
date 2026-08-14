import { describe, expect, it } from "vitest";

import { deserialize, serialize } from "../../src/lib/.serialization.js";

describe("browser structured serialization", () => {
	it("matches native structured-clone graph semantics", () => {
		const shared = { value: 1 };
		const buffer = new ArrayBuffer(8);
		const array = [shared, undefined, shared];

		delete array[1];

		const input: Record<string, unknown> = {
			array,
			buffer,
			bytes: new Uint8Array(buffer, 2, 4),
			date: new Date(123),
			map: new Map([[shared, new Set([1, 2])]]),
			regexp: /value/gi,
		};

		input.self = input;

		const expected = structuredClone(input);
		const actual = deserialize(serialize(input)) as typeof input;
		const actualArray = actual.array as unknown[];
		const expectedArray = expected.array as unknown[];

		expect(actual).toEqual(expected);
		expect(actual.self).toBe(actual);
		expect(actualArray[0]).toBe(actualArray[2]);
		expect(expectedArray[0]).toBe(expectedArray[2]);
		expect(1 in actualArray).toBe(false);
		expect((actual.bytes as Uint8Array).buffer).toBe(actual.buffer);
	});

	it("matches native DataCloneError behavior for unsupported JavaScript values", () => {
		for (const value of [Symbol("value"), () => undefined, new WeakMap(), Promise.resolve()]) {
			expect(() => structuredClone(value)).toThrowError(expect.objectContaining({ name: "DataCloneError" }));
			expect(() => serialize(value)).toThrowError(expect.objectContaining({ name: "DataCloneError" }));
		}
	});
});
