import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { decodeDatagram, encodeDatagram } from "../src/datagram.js";
import { encodeFrame, FrameDecoder } from "../src/stream.js";

const bytes = crypto.getRandomValues(new Uint8Array(64 * 1024));
const datagram = encodeDatagram(1, bytes);
const frame = encodeFrame(bytes);

test("transport codecs", async () => {
	expect(decodeDatagram(datagram).value).toEqual(bytes);
	expect(new FrameDecoder().push(frame)).toHaveLength(1);

	await benchmark(
		"realtime-protocol/datagram-encode-binary-64-kib",
		() => {
			encodeDatagram(1, bytes);
		},
		{
			iterations: 1_000,
		},
	);
	await benchmark(
		"realtime-protocol/datagram-decode-binary-64-kib",
		() => {
			decodeDatagram(datagram);
		},
		{
			iterations: 1_000,
		},
	);
	await benchmark(
		"realtime-protocol/frame-encode-64-kib",
		() => {
			encodeFrame(bytes);
		},
		{ iterations: 1_000 },
	);
	await benchmark(
		"realtime-protocol/frame-decode-64-kib",
		() => {
			new FrameDecoder().push(frame);
		},
		{
			iterations: 1_000,
		},
	);
});
