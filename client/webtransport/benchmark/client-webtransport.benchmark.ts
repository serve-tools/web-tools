import { deserialize, protocol, serialize, subprotocol } from "@serve-tools/realtime-protocol";
import { DatagramRegistry } from "@serve-tools/realtime-protocol/datagram-registry";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import { expect, test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { connect } from "../src/client-webtransport.js";
import type { DatagramWritableOptions, WebTransportBidirectionalStreamLike } from "../src/lib/types.js";

interface Protocol {
	requests: { echo(value: number): number };
	datagrams: { cursor: { client: Uint8Array } };
}

class LoopbackWebTransport {
	readonly ready = Promise.resolve();
	readonly closed = new Promise<never>(() => undefined);
	readonly protocol = subprotocol;
	readonly datagrams = {
		readable: new ReadableStream<Uint8Array>(),
		maxDatagramSize: 1_250,
		createWritable: (_options?: DatagramWritableOptions) =>
			new WritableStream<BufferSource>({ write: () => undefined }),
	};
	#stream = 0;

	async createBidirectionalStream(): Promise<WebTransportBidirectionalStreamLike> {
		const stream = this.#stream++;
		let controller!: ReadableStreamDefaultController<Uint8Array>;
		const readable = new ReadableStream<Uint8Array>({ start: (value) => (controller = value) });
		const decoder = new FrameDecoder();
		let identified = false;
		const registry = stream === 1 ? new DatagramRegistry((payload) => controller.enqueue(payload)) : undefined;
		const writable = new WritableStream<BufferSource>({
			write(chunk) {
				const value = bytes(chunk);

				if (!identified) {
					identified = true;

					return;
				}

				if (registry) {
					registry.receive(value);

					return;
				}

				for (const frame of decoder.push(value)) {
					const message = deserialize(frame);

					if (Array.isArray(message) && message[1] === "request") {
						controller.enqueue(encodeFrame(serialize([protocol, "resolve", message[2], message[4]])));
					}
				}
			},
		});

		return { readable, writable };
	}

	close(): void {}
}

test("WebTransport request and datagram loopback", async () => {
	const client = await connect<Protocol>("https://benchmark.invalid/realtime", {
		transportConstructor: LoopbackWebTransport,
	});

	expect(await client.request("echo", 42)).toBe(42);

	await benchmark(
		"client-webtransport/request-loopback",
		async () => {
			await client.request("echo", 42);
		},
		{ iterations: 10_000 },
	);

	await client.datagrams.write("cursor", Uint8Array.of(1, 2, 3));

	await benchmark(
		"client-webtransport/datagram-write-loopback",
		async () => {
			await client.datagrams.write("cursor", Uint8Array.of(1, 2, 3));
		},
		{ iterations: 10_000 },
	);

	client.close();
});

const bytes = (value: BufferSource): Uint8Array =>
	ArrayBuffer.isView(value)
		? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		: new Uint8Array(value);
