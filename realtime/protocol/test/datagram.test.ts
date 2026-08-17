import { describe, expect, it } from "vitest";

import { decodeDatagram, encodeDatagram } from "../src/datagram.js";
import { DatagramRegistry } from "../src/datagram-registry.js";

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
});
