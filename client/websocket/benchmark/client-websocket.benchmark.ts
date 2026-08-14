import { afterEach, expect, test, vi } from "vitest";

import { benchmark } from "../../benchmark.js";
import { connect } from "../src/client-websocket.js";
import { protocol } from "../src/lib/.internals.js";
import { deserialize, serialize } from "../src/lib/.serialization.js";

interface Protocol {
	requests: {
		echo(value: number): number;
		echoBuffer(value: ArrayBuffer): ArrayBuffer;
	};
	subscriptions: {
		events(): number;
		ready(value: number): number;
	};
}

class LoopbackWebSocket extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	static instance: LoopbackWebSocket | undefined;

	binaryType: BinaryType = "blob";
	readyState = LoopbackWebSocket.CONNECTING;
	subscriptionId?: number;

	constructor(_url: string | URL, _protocols?: string | string[]) {
		super();

		LoopbackWebSocket.instance = this;
		queueMicrotask(() => {
			this.readyState = LoopbackWebSocket.OPEN;
			this.dispatchEvent(new Event("open"));
		});
	}

	send(data: ArrayBuffer): void {
		if (this.readyState !== LoopbackWebSocket.OPEN) throw new DOMException("", "InvalidStateError");

		const message = deserialize(data);

		if (!Array.isArray(message) || message[0] !== protocol) throw new Error("Unexpected client message");

		if (message[1] === "request") {
			this.receive([protocol, "resolve", message[2], message[4]]);
		} else if (message[1] === "subscribe") {
			this.subscriptionId = message[2];

			if (message[3] === "ready") this.receive([protocol, "event", message[2], message[4]]);
		}
	}

	receive(value: unknown): void {
		this.dispatchEvent(new MessageEvent("message", { data: serialize(value) }));
	}

	close(code = 1000, reason = ""): void {
		if (this.readyState === LoopbackWebSocket.CLOSED) return;

		this.readyState = LoopbackWebSocket.CLOSED;
		this.dispatchEvent(Object.assign(new Event("close"), { code, reason, wasClean: code === 1000 }));
	}
}

const openClient = async () => {
	vi.stubGlobal("WebSocket", LoopbackWebSocket);

	const client = await connect<Protocol>("wss://benchmark.invalid");
	const socket = LoopbackWebSocket.instance!;

	return { client, socket };
};

afterEach(() => {
	LoopbackWebSocket.instance = undefined;
	vi.unstubAllGlobals();
});

test("client request loopback", async () => {
	const { client } = await openClient();

	try {
		expect(await client.request("echo", 42)).toBe(42);

		await benchmark(
			"client-websocket/request-loopback",
			async () => {
				await client.request("echo", 42);
			},
			{ iterations: 10_000 },
		);

		await benchmark(
			"client-websocket/request-1-mib-loopback",
			async () => {
				const output = await client.request("echoBuffer", new ArrayBuffer(1024 * 1024));

				if (output.byteLength !== 1024 * 1024) throw new Error("Unexpected echoed buffer size");
			},
			{ iterations: 20, samples: 10, warmup: 3 },
		);
	} finally {
		client.close();
	}
});

test("client subscription loopback", async () => {
	const { client, socket } = await openClient();
	let received = Promise.withResolvers<void>();
	const subscription = client.subscribe("events", () => received.resolve());
	const subscriptionId = socket.subscriptionId!;

	try {
		await benchmark(
			"client-websocket/subscription-event-loopback",
			async () => {
				received = Promise.withResolvers<void>();
				socket.receive([protocol, "event", subscriptionId, 42]);
				await received.promise;
			},
			{ iterations: 10_000 },
		);

		await benchmark(
			"client-websocket/subscription-open-event-cancel-loopback",
			async () => {
				const delivered = Promise.withResolvers<void>();
				const handle = client.subscribe("ready", 42, () => delivered.resolve());

				await delivered.promise;
				handle.unsubscribe();
			},
			{ iterations: 5_000 },
		);
	} finally {
		subscription.unsubscribe();
		client.close();
	}
});
