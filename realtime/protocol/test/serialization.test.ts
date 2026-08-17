import { describe, expect, it } from "vitest";

import { deserialize, serialize } from "../src/realtime-protocol.js";

const roundTrip = <Value>(value: Value): Value => deserialize(serialize(value)) as Value;

describe("structured serialization", () => {
	it("preserves primitive roots and numeric sentinels", () => {
		for (const value of [undefined, null, true, false, "text", 0, 42, Number.NaN, Infinity, -Infinity, -0, 42n]) {
			const clone = roundTrip(value);

			if (typeof value === "number") {
				expect(Object.is(clone, value)).toBe(true);
			} else {
				expect(clone).toBe(value);
			}
		}
	});

	it("preserves cycles, aliases, sparse arrays, and safe object keys", () => {
		const shared = { value: 1 };
		const sparseInput = [1, undefined, undefined];

		delete sparseInput[1];

		const input: Record<string, unknown> = {
			first: shared,
			second: shared,
			sparse: sparseInput,
		};

		input.self = input;
		Object.defineProperty(input, "__proto__", { value: shared, enumerable: true });

		const clone = roundTrip(input) as typeof input;
		const sparse = clone.sparse as unknown[];

		expect(clone).not.toBe(input);
		expect(clone.self).toBe(clone);
		expect(clone.first).toBe(clone.second);
		expect(Object.hasOwn(clone, "__proto__")).toBe(true);
		expect(Object.getOwnPropertyDescriptor(clone, "__proto__")?.value).toBe(clone.first);
		expect(sparse).toHaveLength(3);
		expect(0 in sparse).toBe(true);
		expect(1 in sparse).toBe(false);
		expect(2 in sparse).toBe(true);
	});

	it("preserves portable structured-clone built-ins", () => {
		const cause = new TypeError("cause");
		const error = new RangeError("failure", { cause });
		const aggregate = new AggregateError([cause], "aggregate", { cause: "reason" });
		const input = {
			date: new Date(1_234),
			invalidDate: new Date(Number.NaN),
			regexp: /hello/giu,
			map: new Map<unknown, unknown>([["key", { value: 1 }]]),
			set: new Set([1, 2]),
			boolean: new Boolean(true),
			number: new Number(2),
			string: new String("three"),
			bigint: Object(4n),
			error,
			aggregate,
		};

		const clone = roundTrip(input);

		expect(clone.date).toEqual(structuredClone(input.date));
		expect(Number.isNaN(clone.invalidDate.getTime())).toBe(true);
		expect(clone.regexp).toEqual(input.regexp);
		expect(clone.map).toEqual(input.map);
		expect(clone.set).toEqual(input.set);
		expect(clone.boolean.valueOf()).toBe(true);
		expect(clone.number.valueOf()).toBe(2);
		expect(clone.string.valueOf()).toBe("three");
		expect(clone.bigint.valueOf()).toBe(4n);
		expect(clone.error).toMatchObject({ name: "RangeError", message: "failure", cause: { message: "cause" } });
		expect(clone.aggregate).toMatchObject({ name: "AggregateError", message: "aggregate", cause: "reason" });
		expect(clone.aggregate.errors[0]).toMatchObject({ name: "TypeError", message: "cause" });
	});

	it("preserves buffers, views, offsets, and shared backing identity", () => {
		const buffer = new ArrayBuffer(16);
		const bytes = new Uint8Array(buffer, 2, 8);
		const words = new Uint16Array(buffer, 4, 3);
		const view = new DataView(buffer, 3, 5);

		bytes.set([1, 2, 3, 4, 5, 6, 7, 8]);

		const clone = roundTrip({ buffer, bytes, words, view });

		expect(clone.buffer).not.toBe(buffer);
		expect([...new Uint8Array(clone.buffer)]).toEqual([...new Uint8Array(buffer)]);
		expect(clone.bytes.buffer).toBe(clone.buffer);
		expect(clone.words.buffer).toBe(clone.buffer);
		expect(clone.view.buffer).toBe(clone.buffer);
		expect(clone.bytes).toMatchObject({ byteOffset: 2, length: 8 });
		expect(clone.words).toMatchObject({ byteOffset: 4, length: 3 });
		expect(clone.view).toMatchObject({ byteOffset: 3, byteLength: 5 });
	});

	it("decodes buffer payloads from offset views", () => {
		const payload = new Uint8Array(serialize(new Uint8Array([1, 2, 3]).buffer));
		const framed = new Uint8Array(payload.length + 4);

		framed.set(payload, 2);

		const clone = deserialize(framed.subarray(2, -2)) as ArrayBuffer;

		expect([...new Uint8Array(clone)]).toEqual([1, 2, 3]);
	});

	it("preserves resizable ArrayBuffers when supported", () => {
		const input = new ArrayBuffer(4, { maxByteLength: 16 });

		if (!input.resizable) {
			return;
		}

		new Uint8Array(input).set([1, 2, 3, 4]);

		const clone = roundTrip(input);

		expect(clone.resizable).toBe(true);
		expect(clone.maxByteLength).toBe(16);
		expect([...new Uint8Array(clone)]).toEqual([1, 2, 3, 4]);
	});

	it("uses intrinsic brands for spoofed built-in tags", () => {
		const input = { value: 1, [Symbol.toStringTag]: "Date" };
		const clone = roundTrip(input);

		expect(clone).toEqual({ value: 1 });
		expect(clone).not.toBeInstanceOf(Date);
	});

	it("rejects values outside the supported structured-clone subset", () => {
		expect(() => serialize(Symbol("value"))).toThrowError(expect.objectContaining({ name: "DataCloneError" }));
		expect(() => serialize(() => undefined)).toThrowError(expect.objectContaining({ name: "DataCloneError" }));
		expect(() => serialize(new WeakMap())).toThrowError(expect.objectContaining({ name: "DataCloneError" }));

		if (typeof SharedArrayBuffer === "function") {
			expect(() => serialize(new SharedArrayBuffer(8))).toThrowError(
				expect.objectContaining({ name: "DataCloneError" }),
			);
		}
	});

	it("rejects malformed payloads", () => {
		const encode = (metadata: unknown, binary: number[] = []): ArrayBuffer => {
			const head = new TextEncoder().encode(JSON.stringify(metadata));
			const output = new Uint8Array(head.length + 1 + binary.length);

			output.set(head);
			output.set(binary, head.length + 1);

			return output.buffer;
		};

		for (const payload of [
			new ArrayBuffer(0),
			encode(["wrong/1", 0, [null]]),
			encode(["@serve-tools/structured-serialization/1", 1, [null]]),
			encode(["@serve-tools/structured-serialization/1", 0, [["A", 0, 2]]], [1]),
			encode(
				[
					"@serve-tools/structured-serialization/1",
					0,
					[
						["T", 99, 1, 0, 1],
						["A", 0, 1],
					],
				],
				[1],
			),
		]) {
			expect(() => deserialize(payload)).toThrowError(expect.objectContaining({ name: "DataCloneError" }));
		}
	});

	it("rejects encoded buffer capacities above a caller-provided resource limit", () => {
		const metadata = new TextEncoder().encode(
			JSON.stringify(["@serve-tools/structured-serialization/1", 0, [["A", 0, 1, 1_000_000_000]]]),
		);
		const payload = new Uint8Array(metadata.length + 2);

		payload.set(metadata);
		payload[payload.length - 1] = 1;

		expect(() => deserialize(payload, { maximumArrayBufferLength: 1_024 })).toThrowError(
			expect.objectContaining({ name: "DataCloneError" }),
		);
	});

	it("keeps stable versioned golden frames", () => {
		const text = new TextDecoder().decode(serialize({ ok: true }));

		expect(text).toBe('["@serve-tools/structured-serialization/1",0,[{"ok":1},true]]\u0000');

		const binary = new Uint8Array(serialize(new Uint8Array([1, 2, 3]).buffer));
		const delimiter = binary.indexOf(0);

		expect(new TextDecoder().decode(binary.subarray(0, delimiter))).toBe(
			'["@serve-tools/structured-serialization/1",0,[["A",0,3]]]',
		);
		expect([...binary.subarray(delimiter + 1)]).toEqual([1, 2, 3]);
	});
});
