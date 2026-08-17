import { describe, expect, it } from "vitest";

import { encodeFrame, FrameDecoder } from "../src/stream.js";

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

describe("stream framing", () => {
	it("encodes a stable four-byte big-endian length prefix", () => {
		expect([...encodeFrame(bytes(1, 2, 3))]).toEqual([0, 0, 0, 3, 1, 2, 3]);
	});

	it("decodes partial and coalesced frames without retaining input views", () => {
		const decoder = new FrameDecoder();
		const first = encodeFrame(bytes(1, 2, 3));
		const second = encodeFrame(bytes(4, 5));
		const combined = new Uint8Array(first.length + second.length);

		combined.set(first);
		combined.set(second, first.length);

		expect(decoder.push(combined.subarray(0, 2))).toEqual([]);
		expect(decoder.push(combined.subarray(2, 6))).toEqual([]);

		const payloads = decoder.push(combined.subarray(6));

		combined.fill(0);
		expect(payloads.map((payload) => [...new Uint8Array(payload)])).toEqual([
			[1, 2, 3],
			[4, 5],
		]);
	});

	it("supports empty frames and reset after partial input", () => {
		const decoder = new FrameDecoder();

		expect(decoder.push(encodeFrame(new ArrayBuffer(0)))).toEqual([new ArrayBuffer(0)]);

		decoder.push(bytes(0, 0));
		decoder.reset();

		expect(decoder.push(encodeFrame(bytes(9))).map((payload) => [...new Uint8Array(payload)])).toEqual([[9]]);
		expect(() => decoder.finish()).not.toThrow();
	});

	it("detects a truncated final frame and resets for reuse", () => {
		const decoder = new FrameDecoder();

		decoder.push(bytes(0, 0, 0, 2, 1));

		expect(() => decoder.finish()).toThrow(RangeError);
		expect(decoder.push(encodeFrame(bytes(2))).map((payload) => [...new Uint8Array(payload)])).toEqual([[2]]);
	});

	it("rejects frames above the configured maximum and recovers after reset", () => {
		const decoder = new FrameDecoder(2);

		expect(() => decoder.push(encodeFrame(bytes(1, 2, 3)))).toThrow(RangeError);
		expect(() => decoder.push(bytes(255, 255, 255, 255))).toThrow(RangeError);
		expect(decoder.push(encodeFrame(bytes(4, 5))).map((payload) => [...new Uint8Array(payload)])).toEqual([[4, 5]]);
	});
});
