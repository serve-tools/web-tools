import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { decodeDatagram, encodeDatagram } from "../src/datagram.js";
import { decodeBase64, encodeBase64 } from "../src/sse.js";
import { encodeFrame, FrameDecoder } from "../src/stream.js";

const bytes = crypto.getRandomValues(new Uint8Array(64 * 1024));
const base64 = encodeBase64(bytes);
const datagram = encodeDatagram(1, bytes);
const frame = encodeFrame(bytes);

test("transport codecs", async () => {
	expect(decodeBase64(base64)).toEqual(bytes);
	expect(decodeDatagram(datagram).value).toEqual(bytes);
	expect(new FrameDecoder().push(frame)).toHaveLength(1);

	await benchmark(
		"realtime-protocol/base64-encode-64-kib",
		() => {
			encodeBase64(bytes);
		},
		{ iterations: 100 },
	);
	await benchmark(
		"realtime-protocol/base64-decode-64-kib",
		() => {
			decodeBase64(base64);
		},
		{ iterations: 100 },
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
