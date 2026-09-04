import { deserialize, protocol, serialize, subprotocol } from "@serve-tools/realtime-protocol";
import { decodeDatagram, encodeDatagram } from "@serve-tools/realtime-protocol/datagram";
import { DatagramRegistry } from "@serve-tools/realtime-protocol/datagram-registry";
import { encodeFrame, FrameDecoder } from "@serve-tools/realtime-protocol/stream";
import { beforeEach, describe, expect, it } from "vitest";

import { connect } from "../src/client-webtransport.js";
import type {
	DatagramWritableOptions,
	WebTransportBidirectionalStreamLike,
	WebTransportDatagramsLike,
} from "../src/lib/types.js";

interface TestProtocol {
	requests: { ping(value: string): string };
	datagrams: {
		packet: { client: Uint8Array };
		presence: { server: { online: boolean } };
	};
}

interface DatagramWritableRecord {
	readonly options: DatagramWritableOptions | undefined;
	readonly receiver: unknown;
	readonly sent: Uint8Array[];
	closed: boolean;
	abortReason?: unknown;
}

class FakeWebTransport {
	static instance: FakeWebTransport;
	static blockStreams = false;
	static createWritableError: Error | undefined;
	static datagramMode: "modern" | "legacy" | "both" | "neither" = "modern";
	static failStreamAt: number | undefined;
	static readyError: Error | undefined;
	static suppressRegistryReplies = false;
	readonly ready = FakeWebTransport.readyError ? Promise.reject(FakeWebTransport.readyError) : Promise.resolve();
	readonly #closed = Promise.withResolvers<void>();
	readonly closed = this.#closed.promise;
	readonly protocol = subprotocol;
	readonly options: Record<string, unknown>;
	readonly sentDatagrams: Uint8Array[] = [];
	readonly createdDatagramWritables: DatagramWritableRecord[] = [];
	readonly registryPayloads: Uint8Array[] = [];
	readonly #streamRequested = Promise.withResolvers<void>();
	readonly firstStreamRequested = this.#streamRequested.promise;
	closeInfo: { readonly closeCode?: number; readonly reason?: string } | undefined;
	readonly datagrams: WebTransportDatagramsLike;
	legacyWriterRequests = 0;
	nativeMaxDatagramSize = 1_250;
	#datagramController!: ReadableStreamDefaultController<Uint8Array>;
	#registryController?: ReadableStreamDefaultController<Uint8Array>;
	#streamCount = 0;
	#serverRegistry?: DatagramRegistry;

	get streamCount(): number {
		return this.#streamCount;
	}

	constructor(_url: string | URL, options: Record<string, unknown> = {}) {
		FakeWebTransport.instance = this;

		this.options = options;
		const transport = this;

		const datagrams: WebTransportDatagramsLike = {
			readable: new ReadableStream({ start: (controller) => (this.#datagramController = controller) }),
			get maxDatagramSize() {
				return transport.nativeMaxDatagramSize;
			},
		};

		if (FakeWebTransport.datagramMode === "legacy" || FakeWebTransport.datagramMode === "both") {
			const writable = new WritableStream<BufferSource>({
				write: (chunk) => void this.sentDatagrams.push(bytes(chunk)),
			});
			const getWriter = writable.getWriter.bind(writable);

			Object.defineProperty(writable, "getWriter", {
				value: () => {
					++this.legacyWriterRequests;

					return getWriter();
				},
			});

			Object.defineProperty(datagrams, "writable", { value: writable });
		}

		if (FakeWebTransport.datagramMode === "modern" || FakeWebTransport.datagramMode === "both") {
			Object.defineProperty(datagrams, "createWritable", {
				value: function (this: WebTransportDatagramsLike, writableOptions?: DatagramWritableOptions) {
					if (FakeWebTransport.createWritableError) {
						throw FakeWebTransport.createWritableError;
					}

					return transport.createDatagramWritable(this, writableOptions);
				},
			});
		}

		this.datagrams = datagrams;
	}

	createDatagramWritable(
		receiver: unknown,
		writableOptions: DatagramWritableOptions | undefined,
	): WritableStream<BufferSource> {
		const record: DatagramWritableRecord = {
			options: writableOptions,
			receiver,
			sent: [],
			closed: false,
		};

		this.createdDatagramWritables.push(record);

		return new WritableStream({
			write: (chunk) => {
				const value = bytes(chunk);

				record.sent.push(value);
				this.sentDatagrams.push(value);
			},
			close: () => {
				record.closed = true;
			},
			abort: (reason) => {
				record.abortReason = reason;
			},
		});
	}

	async createBidirectionalStream(): Promise<WebTransportBidirectionalStreamLike> {
		this.#streamRequested.resolve();

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

				this.registryPayloads.push(value);

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
		FakeWebTransport.createWritableError = undefined;
		FakeWebTransport.datagramMode = "modern";
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
		expect(transport.datagrams.writable).toBeUndefined();
		expect(transport.createdDatagramWritables).toHaveLength(1);
		expect(transport.createdDatagramWritables[0]?.options).toBeUndefined();
		expect(transport.createdDatagramWritables[0]?.receiver).toBe(transport.datagrams);

		transport.nativeMaxDatagramSize = 900;

		expect(client.datagrams.maxDatagramSize).toBe(900);

		await client.datagrams.write("packet", Uint8Array.of(1, 2, 3));

		const packet = decodeDatagram(transport.sentDatagrams[0]!);

		expect(packet.value).toEqual(Uint8Array.of(1, 2, 3));

		const presence = Promise.withResolvers<{ online: boolean }>();

		client.datagrams.subscribe("presence", presence.resolve);

		await transport.send("presence", { online: true });
		await expect(presence.promise).resolves.toEqual({ online: true });

		client.close();
	});

	it("prefers createWritable when both outgoing datagram APIs are available", async () => {
		FakeWebTransport.datagramMode = "both";

		const client = await connect<TestProtocol>("https://example.test/realtime", {
			transportConstructor: FakeWebTransport,
		});
		const transport = FakeWebTransport.instance;

		expect(transport.createdDatagramWritables).toHaveLength(1);
		expect(transport.createdDatagramWritables[0]?.receiver).toBe(transport.datagrams);
		expect(transport.legacyWriterRequests).toBe(0);
		expect(transport.datagrams.writable?.locked).toBe(false);

		await client.datagrams.write("packet", Uint8Array.of(4));

		expect(decodeDatagram(transport.createdDatagramWritables[0]!.sent[0]!).value).toEqual(Uint8Array.of(4));
		expect(transport.legacyWriterRequests).toBe(0);

		client.close();
	});

	it("propagates createWritable setup errors without falling back to the legacy writable", async () => {
		FakeWebTransport.datagramMode = "both";

		const nativeError = new Error("native writable setup failed");

		FakeWebTransport.createWritableError = nativeError;

		await expect(
			connect<TestProtocol>("https://example.test/realtime", { transportConstructor: FakeWebTransport }),
		).rejects.toBe(nativeError);

		const transport = FakeWebTransport.instance;

		expect(transport.createdDatagramWritables).toHaveLength(0);
		expect(transport.legacyWriterRequests).toBe(0);
		expect(transport.datagrams.writable?.locked).toBe(false);
		expect(transport.streamCount).toBe(0);
		expect(transport.closeInfo?.reason).toBe("Connection setup failed");
	});

	it("rejects setup before reliable streams when no outgoing datagram API is available", async () => {
		FakeWebTransport.datagramMode = "neither";

		await expect(
			connect<TestProtocol>("https://example.test/realtime", { transportConstructor: FakeWebTransport }),
		).rejects.toMatchObject({
			name: "NotSupportedError",
			message: "Writable WebTransport datagrams are not supported",
		});

		expect(FakeWebTransport.instance.streamCount).toBe(0);
		expect(FakeWebTransport.instance.closeInfo?.reason).toBe("Connection setup failed");
	});

	it("uses one legacy writable for shared writes and rejects named queues without side effects", async () => {
		FakeWebTransport.datagramMode = "legacy";

		const client = await connect<TestProtocol>("https://example.test/realtime", {
			transportConstructor: FakeWebTransport,
		});
		const transport = FakeWebTransport.instance;

		expect(transport.datagrams.createWritable).toBeUndefined();
		expect(transport.legacyWriterRequests).toBe(1);
		expect(transport.datagrams.writable?.locked).toBe(true);

		const registrationCount = transport.registryPayloads.length;
		const withoutOptions = captureSynchronousError(() => client.datagrams.createWritable("packet"));
		const withOptions = captureSynchronousError(() =>
			client.datagrams.createWritable("packet", { sendGroup: {}, sendOrder: 2 }),
		);

		expect(withoutOptions).toMatchObject({
			name: "NotSupportedError",
			message: "Independent WebTransport datagram writables are not supported",
		});
		expect(withOptions).toMatchObject({
			name: "NotSupportedError",
			message: "Independent WebTransport datagram writables are not supported",
		});
		expect(transport.legacyWriterRequests).toBe(1);
		expect(transport.registryPayloads).toHaveLength(registrationCount);

		await expect(client.request("ping", "still available")).resolves.toBe("still available!");
		await Promise.all([
			client.datagrams.write("packet", Uint8Array.of(1)),
			client.datagrams.write("packet", Uint8Array.of(2)),
		]);

		expect(transport.sentDatagrams.map((value) => decodeDatagram(value).value)).toEqual([
			Uint8Array.of(1),
			Uint8Array.of(2),
		]);

		client.close("finished");
		await client.closed;

		const closedRegistrationCount = transport.registryPayloads.length;
		const afterClose = captureSynchronousError(() => client.datagrams.createWritable("packet"));

		expect(afterClose).toMatchObject({ name: "ConnectionClosedError" });
		expect(transport.legacyWriterRequests).toBe(1);
		expect(transport.registryPayloads).toHaveLength(closedRegistrationCount);
	});

	it("keeps modern named writable queues independent and forwards native options and receiver", async () => {
		const client = await connect<TestProtocol>("https://example.test/realtime", {
			transportConstructor: FakeWebTransport,
		});
		const transport = FakeWebTransport.instance;
		const firstOptions = { sendGroup: {}, sendOrder: 1 };
		const secondOptions = { sendGroup: {}, sendOrder: 2 };
		const firstWriter = client.datagrams.createWritable("packet", firstOptions).getWriter();
		const secondWriter = client.datagrams.createWritable("packet", secondOptions).getWriter();

		expect(transport.createdDatagramWritables).toHaveLength(3);
		expect(transport.createdDatagramWritables.slice(1).map(({ options }) => options)).toEqual([
			firstOptions,
			secondOptions,
		]);
		expect(transport.createdDatagramWritables.every(({ receiver }) => receiver === transport.datagrams)).toBe(true);

		await Promise.all([firstWriter.write(Uint8Array.of(3)), secondWriter.write(Uint8Array.of(4))]);

		expect(decodeDatagram(transport.createdDatagramWritables[1]!.sent[0]!).value).toEqual(Uint8Array.of(3));
		expect(decodeDatagram(transport.createdDatagramWritables[2]!.sent[0]!).value).toEqual(Uint8Array.of(4));

		await firstWriter.close();
		await secondWriter.write(Uint8Array.of(6));

		const abortReason = new Error("queue stopped");

		await secondWriter.abort(abortReason);
		await client.datagrams.write("packet", Uint8Array.of(5));

		expect(transport.createdDatagramWritables[1]?.closed).toBe(true);
		expect(transport.createdDatagramWritables[2]?.abortReason).toBe(abortReason);
		expect(decodeDatagram(transport.createdDatagramWritables[2]!.sent[1]!).value).toEqual(Uint8Array.of(6));
		expect(decodeDatagram(transport.createdDatagramWritables[0]!.sent[0]!).value).toEqual(Uint8Array.of(5));

		client.close();
	});

	it("releases the legacy writer lock when setup fails or is aborted", async () => {
		FakeWebTransport.datagramMode = "legacy";
		FakeWebTransport.failStreamAt = 1;

		await expect(
			connect<TestProtocol>("https://example.test/realtime", { transportConstructor: FakeWebTransport }),
		).rejects.toThrow("stream setup failed");

		const failedTransport = FakeWebTransport.instance;

		expect(failedTransport.legacyWriterRequests).toBe(1);
		expect(failedTransport.datagrams.writable?.locked).toBe(false);
		expect(failedTransport.closeInfo?.reason).toBe("Connection setup failed");

		FakeWebTransport.failStreamAt = undefined;
		FakeWebTransport.blockStreams = true;

		const setupController = new AbortController();
		const connecting = connect<TestProtocol>("https://example.test/realtime", {
			signal: setupController.signal,
			transportConstructor: FakeWebTransport,
		});

		const abortedTransport = FakeWebTransport.instance;

		await abortedTransport.firstStreamRequested;

		expect(abortedTransport.legacyWriterRequests).toBe(1);
		expect(abortedTransport.datagrams.writable?.locked).toBe(true);

		setupController.abort(new Error("legacy setup stopped"));

		await expect(connecting).rejects.toThrow("legacy setup stopped");
		expect(abortedTransport.datagrams.writable?.locked).toBe(false);
		expect(abortedTransport.closeInfo?.reason).toBe("Connection aborted");
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

const captureSynchronousError = (callback: () => unknown): unknown => {
	try {
		callback();
	} catch (error) {
		return error;
	}

	throw new Error("Expected a synchronous error");
};
