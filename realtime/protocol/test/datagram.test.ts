import { describe, expect, it } from "vitest";

import { decodeDatagram, encodeDatagram } from "../src/datagram.js";
import {
	DatagramRegistry,
	defaultMaximumDatagramRegistryControlFrameLength,
	defaultMaximumDatagramRegistryNameLength,
	defaultMaximumPeerRegistrations,
} from "../src/datagram-registry.js";
import { protocol, serialize } from "../src/realtime-protocol.js";
import { encodeFrame } from "../src/stream.js";

describe("typed datagrams", () => {
	it("preserves structured values and normalizes binary values to Uint8Array", () => {
		expect(decodeDatagram(encodeDatagram(7, { x: 4 }))).toEqual({ kind: 7, value: { x: 4 } });
		expect(decodeDatagram(encodeDatagram(0xffff_ffff, new Uint8Array()))).toEqual({
			kind: 0xffff_ffff,
			value: new Uint8Array(),
		});
		expect(decodeDatagram(encodeDatagram(9, new Uint16Array([258])))).toEqual({
			kind: 9,
			value: new Uint8Array(new Uint16Array([258]).buffer),
		});
	});

	it("rejects invalid envelopes and kind identifiers", () => {
		expect(() => encodeDatagram(-1, null)).toThrow(RangeError);
		expect(() => decodeDatagram(Uint8Array.of(0, 1))).toThrow("missing its envelope");
		expect(() => decodeDatagram(Uint8Array.of(0, 0, 0, 1, 9))).toThrow("unknown payload encoding");
	});

	it("bounds structured buffer capacities during decoding", () => {
		const payload = encodeDatagram(1, { buffer: new ArrayBuffer(4, { maxByteLength: 1_024 }) });

		expect(() => decodeDatagram(payload, { maximumArrayBufferLength: 16 })).toThrowError(
			expect.objectContaining({ name: "DataCloneError" }),
		);
	});

	it("registers names symmetrically over a reliable byte stream", async () => {
		let left!: DatagramRegistry;
		let right!: DatagramRegistry;

		left = new DatagramRegistry((payload) => right.receive(payload));
		right = new DatagramRegistry((payload) => left.receive(payload));

		const first = await left.register("cursor");
		const again = await left.register("cursor");

		expect(first).toBe(1);
		expect(again).toBe(first);
		expect(right.name(first)).toBe("cursor");
	});

	it("allows registration to retry after a synchronous transport failure", async () => {
		let peer!: DatagramRegistry;
		let fail = true;
		const registry = new DatagramRegistry((payload) => {
			if (fail) {
				fail = false;

				throw new Error("stream unavailable");
			}

			peer.receive(payload);
		});

		peer = new DatagramRegistry((payload) => registry.receive(payload));

		expect(() => registry.register("cursor")).toThrow("stream unavailable");
		await expect(registry.register("cursor")).resolves.toBe(1);
	});

	it("bounds distinct peer registrations while preserving repeated registrations", async () => {
		let left!: DatagramRegistry;
		let right!: DatagramRegistry;

		left = new DatagramRegistry((payload) => right.receive(payload));
		right = new DatagramRegistry((payload) => left.receive(payload), { maximumPeerRegistrations: 1 });

		await expect(left.register("cursor")).resolves.toBe(1);
		await expect(left.register("cursor")).resolves.toBe(1);
		expect(() => left.register("presence")).toThrow("peer registration limit");
		expect(right.name(1)).toBe("cursor");
	});

	it("validates the peer registration limit", () => {
		expect(defaultMaximumPeerRegistrations).toBe(256);
		expect(defaultMaximumDatagramRegistryNameLength).toBe(256);
		expect(defaultMaximumDatagramRegistryControlFrameLength).toBe(4 * 1024);
		expect(() => new DatagramRegistry(() => undefined, { maximumPeerRegistrations: 0 })).toThrow(RangeError);
		expect(() => new DatagramRegistry(() => undefined, { maximumNameLength: 0 })).toThrow(RangeError);
		expect(() => new DatagramRegistry(() => undefined, { maximumControlFrameLength: 0 })).toThrow(RangeError);
	});

	it("bounds outgoing and incoming registration names", () => {
		const registry = new DatagramRegistry(() => undefined, { maximumNameLength: 3 });

		expect(() => registry.register("four")).toThrow("registration name exceeds");
		expect(() => registry.receive(encodeFrame(serialize([protocol, "register", 1, "four"])))).toThrow(
			"registration name exceeds",
		);
	});

	it("bounds outgoing and incoming registry control frames", () => {
		const registry = new DatagramRegistry(() => undefined, { maximumControlFrameLength: 8 });

		expect(() => registry.register("a")).toThrow("control frame exceeds");
		expect(() => registry.receive(encodeFrame(serialize([protocol, "registered", 1, 1])))).toThrow(
			"stream frame exceeds",
		);
	});

	it("rejects declared buffer capacity before validating registry messages", () => {
		const buffer = new ArrayBuffer(0, { maxByteLength: 1_024 });
		const registry = new DatagramRegistry(() => undefined);

		expect(() => registry.receive(encodeFrame(serialize({ buffer })))).toThrowError(
			expect.objectContaining({ name: "DataCloneError" }),
		);
	});
});
