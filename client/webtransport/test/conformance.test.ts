import { deserialize, protocol, serialize, subprotocol } from "@serve-tools/realtime-protocol";
import { decodeDatagram, encodeDatagram } from "@serve-tools/realtime-protocol/datagram";
import { DatagramRegistry } from "@serve-tools/realtime-protocol/datagram-registry";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import { describe, expect, it } from "vitest";

import { connect } from "../src/client-webtransport.js";
import type { DatagramWritableOptions, WebTransportBidirectionalStreamLike } from "../src/lib/types.js";

interface TestProtocol {
	requests: { ping(value: string): string };
	datagrams: {
		packet: { client: Uint8Array };
		presence: { server: { online: boolean } };
	};
}

class FakeWebTransport {
	static instance: FakeWebTransport;
	static blockStreams = false;
	readonly ready = Promise.resolve();
	readonly closed = new Promise<never>(() => {});
	readonly protocol = subprotocol;
	readonly options: Record<string, unknown>;
	readonly sentDatagrams: Uint8Array[] = [];
	closeInfo: { readonly closeCode?: number; readonly reason?: string } | undefined;
	readonly datagrams: {
		readonly readable: ReadableStream<Uint8Array>;
		readonly maxDatagramSize: number;
		createWritable(options?: DatagramWritableOptions): WritableStream<BufferSource>;
	};
	#datagramController!: ReadableStreamDefaultController<Uint8Array>;
	#streamCount = 0;
	#serverRegistry?: DatagramRegistry;

	constructor(_url: string | URL, options: Record<string, unknown> = {}) {
		FakeWebTransport.instance = this;

		this.options = options;

		this.datagrams = {
			readable: new ReadableStream({ start: (controller) => (this.#datagramController = controller) }),
			maxDatagramSize: 1_250,
			createWritable: () => new WritableStream({ write: (chunk) => void this.sentDatagrams.push(bytes(chunk)) }),
		};
	}

	async createBidirectionalStream(): Promise<WebTransportBidirectionalStreamLike> {
		if (FakeWebTransport.blockStreams) {
			return new Promise(() => undefined);
		}

		const role = this.#streamCount++;

		let controller!: ReadableStreamDefaultController<Uint8Array>;

		const readable = new ReadableStream<Uint8Array>({ start: (value) => (controller = value) });

		if (role === 0) {
			const decoder = new FrameDecoder();

			let identified = false;

			const writable = new WritableStream<BufferSource>({
				write: (chunk) => {
					const value = bytes(chunk);

					if (!identified) {
						identified = true;

						expect(value).toEqual(Uint8Array.of(0));

						return;
					}

					for (const frame of decoder.push(value)) {
						const message = deserialize(frame);

						if (Array.isArray(message) && message[1] === "request") {
							controller.enqueue(
								encodeFrame(serialize([protocol, "resolve", message[2], `${message[4]}!`])),
							);
						}
					}
				},
			});

			return { readable, writable };
		}

		this.#serverRegistry = new DatagramRegistry((payload) => controller.enqueue(payload));

		let identified = false;

		const writable = new WritableStream<BufferSource>({
			write: (chunk) => {
				const value = bytes(chunk);

				if (!identified) {
					identified = true;

					expect(value).toEqual(Uint8Array.of(1));

					return;
				}

				this.#serverRegistry!.receive(value);
			},
		});

		return { readable, writable };
	}

	async send(name: string, value: unknown): Promise<void> {
		const kind = await this.#serverRegistry!.register(name);

		this.#datagramController.enqueue(encodeDatagram(kind, value));
	}

	sendUnknown(): void {
		this.#datagramController.enqueue(encodeDatagram(999, { early: true }));
	}

	close(info?: { readonly closeCode?: number; readonly reason?: string }): void {
		this.closeInfo = info;
	}
}

describe("WebTransport client conformance", () => {
	it("negotiates the native protocol and combines reliable operations with typed datagrams", async () => {
		const client = await connect<TestProtocol>("https://example.test/realtime", {
			transportConstructor: FakeWebTransport,
		});
		const transport = FakeWebTransport.instance;

		expect(transport.options.protocols).toEqual([subprotocol]);

		transport.sendUnknown();

		await Promise.resolve();
		await expect(client.request("ping", "hello")).resolves.toBe("hello!");

		expect(client.datagrams.maxDatagramSize).toBe(1_250);

		await client.datagrams.write("packet", Uint8Array.of(1, 2, 3));

		const packet = decodeDatagram(transport.sentDatagrams[0]!);

		expect(packet.value).toEqual(Uint8Array.of(1, 2, 3));

		const presence = Promise.withResolvers<{ online: boolean }>();

		client.datagrams.subscribe("presence", presence.resolve);

		await transport.send("presence", { online: true });
		await expect(presence.promise).resolves.toEqual({ online: true });

		client.close();
	});

	it("honors aborts during setup and after the client is ready", async () => {
		FakeWebTransport.blockStreams = true;

		const setupController = new AbortController();
		const connecting = connect<TestProtocol>("https://example.test/realtime", {
			signal: setupController.signal,
			transportConstructor: FakeWebTransport,
		});

		await Promise.resolve();

		setupController.abort(new Error("setup stopped"));

		await expect(connecting).rejects.toThrow("setup stopped");

		expect(FakeWebTransport.instance.closeInfo?.reason).toBe("Connection aborted");

		FakeWebTransport.blockStreams = false;

		const lifetimeController = new AbortController();

		await connect<TestProtocol>("https://example.test/realtime", {
			signal: lifetimeController.signal,
			transportConstructor: FakeWebTransport,
		});

		lifetimeController.abort(new Error("session stopped"));

		expect(FakeWebTransport.instance.closeInfo?.reason).toBe("session stopped");
	});
});

const bytes = (value: BufferSource): Uint8Array =>
	ArrayBuffer.isView(value)
		? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		: new Uint8Array(value);
