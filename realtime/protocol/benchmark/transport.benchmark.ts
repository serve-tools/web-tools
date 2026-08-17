import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { decodeDatagram, encodeDatagram } from "../src/datagram.js";
import { encodeFrame, FrameDecoder } from "../src/stream.js";

const bytes = crypto.getRandomValues(new Uint8Array(64 * 1024));
const cursor = { x: 320, y: 180 };
const cursorDatagram = encodeDatagram(1, cursor);
const smallBytes = bytes.subarray(0, 32);
const smallDatagram = encodeDatagram(1, smallBytes);
const datagram = encodeDatagram(1, bytes);
const frame = encodeFrame(bytes);

test("transport codecs", async () => {
	expect(decodeDatagram(datagram).value).toEqual(bytes);
	expect(new FrameDecoder().push(frame)).toHaveLength(1);

	await benchmark(
		"realtime-protocol/datagram-encode-cursor",
		() => {
			encodeDatagram(1, cursor);
		},
		{ iterations: 10_000 },
	);
	await benchmark(
		"realtime-protocol/datagram-decode-cursor",
		() => {
			decodeDatagram(cursorDatagram);
		},
		{ iterations: 10_000 },
	);
	await benchmark(
		"realtime-protocol/datagram-encode-binary-32-b",
		() => {
			encodeDatagram(1, smallBytes);
		},
		{ iterations: 10_000 },
	);
	await benchmark(
		"realtime-protocol/datagram-decode-binary-32-b",
		() => {
			decodeDatagram(smallDatagram);
		},
		{ iterations: 10_000 },
	);
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
