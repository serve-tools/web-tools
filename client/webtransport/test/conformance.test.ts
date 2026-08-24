import { deserialize, protocol, serialize, subprotocol } from "@serve-tools/realtime-protocol";
import { decodeDatagram, encodeDatagram } from "@serve-tools/realtime-protocol/datagram";
import { DatagramRegistry } from "@serve-tools/realtime-protocol/datagram-registry";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import { beforeEach, describe, expect, it } from "vitest";

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
	static failStreamAt: number | undefined;
	static readyError: Error | undefined;
	static suppressRegistryReplies = false;
	readonly ready = FakeWebTransport.readyError ? Promise.reject(FakeWebTransport.readyError) : Promise.resolve();
	readonly #closed = Promise.withResolvers<void>();
	readonly closed = this.#closed.promise;
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
	#registryController?: ReadableStreamDefaultController<Uint8Array>;
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

		if (role === FakeWebTransport.failStreamAt) {
			throw new Error("stream setup failed");
		}

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

		this.#registryController = controller;
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

				if (!FakeWebTransport.suppressRegistryReplies) {
					this.#serverRegistry!.receive(value);
				}
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

	endRegistry(): void {
		this.#registryController?.close();
	}

	close(info?: { readonly closeCode?: number; readonly reason?: string }): void {
		this.closeInfo = info;
		this.#closed.resolve();
	}
}

describe("WebTransport client conformance", () => {
	beforeEach(() => {
		FakeWebTransport.blockStreams = false;
		FakeWebTransport.failStreamAt = undefined;
		FakeWebTransport.readyError = undefined;
		FakeWebTransport.suppressRegistryReplies = false;
	});

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

	it("closes post-ready setup failures", async () => {
		FakeWebTransport.failStreamAt = 1;

		await expect(
			connect<TestProtocol>("https://example.test/realtime", { transportConstructor: FakeWebTransport }),
		).rejects.toThrow("stream setup failed");

		expect(FakeWebTransport.instance.closeInfo?.reason).toBe("Connection setup failed");
	});

	it("closes when the native ready promise rejects", async () => {
		FakeWebTransport.readyError = new Error("native setup failed");

		await expect(
			connect<TestProtocol>("https://example.test/realtime", { transportConstructor: FakeWebTransport }),
		).rejects.toThrow("native setup failed");

		expect(FakeWebTransport.instance.closeInfo?.reason).toBe("Connection setup failed");
	});

	it("rejects pending datagram reads when the client closes", async () => {
		const client = await connect<TestProtocol>("https://example.test/realtime", {
			transportConstructor: FakeWebTransport,
		});
		const reading = client.datagrams.read("presence");

		client.close("finished");

		await expect(reading).rejects.toMatchObject({ name: "ConnectionClosedError" });
		await expect(client.datagrams.read("presence")).rejects.toMatchObject({ name: "ConnectionClosedError" });
	});

	it("deactivates direct datagram subscriptions when the client closes", async () => {
		const client = await connect<TestProtocol>("https://example.test/realtime", {
			transportConstructor: FakeWebTransport,
		});
		const subscription = client.datagrams.subscribe("presence", () => undefined);

		expect(subscription.active).toBe(true);

		client.close();

		await client.closed;

		expect(subscription.active).toBe(false);
	});

	it("fails pending registry work when the registry stream ends cleanly", async () => {
		FakeWebTransport.suppressRegistryReplies = true;

		const client = await connect<TestProtocol>("https://example.test/realtime", {
			transportConstructor: FakeWebTransport,
		});
		const writing = client.datagrams.write("packet", Uint8Array.of(1));
		const rejected = expect(writing).rejects.toThrow("reliable datagram registry stream ended");

		FakeWebTransport.instance.endRegistry();

		await rejected;
		await client.closed;
	});

	it("closes when a structured datagram exceeds the native allocation bound", async () => {
		const client = await connect<TestProtocol>("https://example.test/realtime", {
			transportConstructor: FakeWebTransport,
		});

		await FakeWebTransport.instance.send("presence", { bytes: new Uint8Array(1_251) });
		await client.closed;

		expect(FakeWebTransport.instance.closeInfo?.closeCode).toBe(1);
	});
});

const bytes = (value: BufferSource): Uint8Array =>
	ArrayBuffer.isView(value)
		? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
		: new Uint8Array(value);
