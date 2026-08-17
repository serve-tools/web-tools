import { describe, expect, it } from "vitest";

import {
	binaryContentType,
	decodeBase64,
	EventStreamDecoder,
	encodeBase64,
	encodeServerSentEvent,
	eventStreamContentType,
	isNegotiatedMediaType,
} from "../src/sse.js";

if (!("toBase64" in Uint8Array.prototype)) {
	Object.defineProperty(Uint8Array.prototype, "toBase64", {
		configurable: true,
		value(this: Uint8Array): string {
			let binary = "";

			for (const byte of this) {
				binary += String.fromCharCode(byte);
			}

			return btoa(binary);
		},
	});
}

describe("SSE protocol utilities", () => {
	it("parses split standard event-stream fields", () => {
		const decoder = new EventStreamDecoder();
		const bytes = encodeServerSentEvent("first\nsecond", "update", "4");

		expect(decoder.push(bytes.subarray(0, 7))).toEqual([]);
		expect(decoder.push(bytes.subarray(7))).toEqual([{ data: "first\nsecond", event: "update", id: "4" }]);
		expect(decoder.finish()).toEqual([]);
	});

	it("applies retry fields without dispatching a data-less event", () => {
		const decoder = new EventStreamDecoder();

		expect(decoder.push(new TextEncoder().encode("retry: 1500\n\n"))).toEqual([]);
		expect(decoder.reconnectionTime).toBe(1_500);
	});

	it("round-trips canonical binary event data", () => {
		const bytes = Uint8Array.of(0, 1, 2, 253, 254, 255);

		expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
		expect(() => decodeBase64("not base64")).toThrow(TypeError);
		expect(() => decodeBase64("Zh==")).toThrow(TypeError);
	});

	it("requires the protocol parameter during HTTP media negotiation", () => {
		expect(isNegotiatedMediaType(eventStreamContentType, "text/event-stream")).toBe(true);
		expect(isNegotiatedMediaType(binaryContentType, "application/octet-stream")).toBe(true);
		expect(isNegotiatedMediaType("text/event-stream", "text/event-stream")).toBe(false);
	});
});
