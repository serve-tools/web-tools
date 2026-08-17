import { deserialize, protocol, serialize, subprotocol } from "@serve-tools/realtime-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connect } from "../src/client-websocket.js";

interface TestProtocol {
	requests: {
		add(input: { a: number; b: number }): number;
		fail(): never;
		hold(): never;
		uncloneable(value: unknown): void;
	};
	subscriptions: {
		numbers(start: number): number;
	};
}

class FakeWebSocket extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	static readonly instances: FakeWebSocket[] = [];

	readonly sent: ArrayBuffer[] = [];
	readonly url: string;
	readonly protocols: string | string[] | undefined;
	readonly protocol: string;
	binaryType: BinaryType = "blob";
	readyState = FakeWebSocket.CONNECTING;

	constructor(url: string | URL, protocols?: string | string[]) {
		super();

		this.url = String(url);
		this.protocols = protocols;
		this.protocol = typeof protocols === "string" ? protocols : (protocols?.[0] ?? "");
		FakeWebSocket.instances.push(this);
	}

	open(): void {
		this.readyState = FakeWebSocket.OPEN;
		this.dispatchEvent(new Event("open"));
	}

	send(data: ArrayBuffer): void {
		if (this.readyState !== FakeWebSocket.OPEN) {
			throw new DOMException("", "InvalidStateError");
		}

		this.sent.push(data);
	}

	receive(value: unknown): void {
		this.dispatchEvent(new MessageEvent("message", { data: serialize(value) }));
	}

	receiveText(value: string): void {
		this.dispatchEvent(new MessageEvent("message", { data: value }));
	}

	close(code = 1000, reason = ""): void {
		if (this.readyState === FakeWebSocket.CLOSED) {
			return;
		}

		this.readyState = FakeWebSocket.CLOSED;
		this.dispatchEvent(Object.assign(new Event("close"), { code, reason, wasClean: code === 1000 }));
	}
}

const openClient = async () => {
	const pending = connect<TestProtocol>("wss://example.test/socket");
	const socket = FakeWebSocket.instances.at(-1)!;

	socket.open();

	return { client: await pending, socket };
};

const messages = (socket: FakeWebSocket): unknown[] => socket.sent.map((value) => deserialize(value));
const report = vi.fn();

beforeEach(() => {
	FakeWebSocket.instances.length = 0;
	report.mockReset();
	vi.stubGlobal("WebSocket", FakeWebSocket);
	vi.stubGlobal("reportError", report);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("connect", () => {
	it("opens an ArrayBuffer WebSocket with the required native subprotocol", async () => {
		const { client, socket } = await openClient();

		expect(socket.url).toBe("wss://example.test/socket");
		expect(socket.protocols).toBe(subprotocol);
		expect(socket.protocol).toBe(subprotocol);
		expect(socket.binaryType).toBe("arraybuffer");

		client.close();
	});

	it("rejects a server that does not select the required subprotocol", async () => {
		const pending = connect<TestProtocol>("wss://example.test/socket");
		const socket = FakeWebSocket.instances.at(-1)!;

		Object.defineProperty(socket, "protocol", { value: "" });
		socket.open();

		await expect(pending).rejects.toMatchObject({ name: "ProtocolError" });
		expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
	});

	it("correlates concurrent requests and reconstructs remote errors", async () => {
		const { client, socket } = await openClient();
		const first = client.request("add", { a: 1, b: 2 });
		const second = client.request("add", { a: 10, b: 5 });

		expect(messages(socket)).toEqual([
			[protocol, "request", 1, "add", { a: 1, b: 2 }],
			[protocol, "request", 2, "add", { a: 10, b: 5 }],
		]);

		socket.receive([protocol, "resolve", 2, 15]);
		socket.receive([protocol, "resolve", 1, 3]);

		await expect(Promise.all([first, second])).resolves.toEqual([3, 15]);

		const failed = client.request("fail");

		socket.receive([protocol, "reject", 3, { name: "RangeError", message: "failure", stack: "remote" }]);

		await expect(failed).rejects.toMatchObject({ name: "RangeError", message: "failure", stack: "remote" });

		client.close();
	});

	it("delivers and completes subscriptions", async () => {
		const { client, socket } = await openClient();
		const values: number[] = [];
		const complete = vi.fn();
		const subscription = client.subscribe("numbers", 3, (value) => values.push(value), { onComplete: complete });

		expect(messages(socket).at(-1)).toEqual([protocol, "subscribe", 1, "numbers", 3]);

		socket.receive([protocol, "event", 1, 3]);
		socket.receive([protocol, "event", 1, 4]);
		socket.receive([protocol, "complete", 1]);

		expect(values).toEqual([3, 4]);
		expect(complete).toHaveBeenCalledOnce();
		expect(subscription.active).toBe(false);

		client.close();
	});

	it("reports subscription callback failures without interrupting lifecycle", async () => {
		const { client, socket } = await openClient();
		const listenerFailure = new Error("listener failure");
		const completionFailure = new Error("completion failure");
		const errorHandlerFailure = new Error("error handler failure");
		const listenerSubscription = client.subscribe("numbers", 0, () => {
			throw listenerFailure;
		});
		const completionSubscription = client.subscribe("numbers", 0, vi.fn(), {
			onComplete: () => {
				throw completionFailure;
			},
		});
		const errorSubscription = client.subscribe("numbers", 0, vi.fn(), {
			onError: () => {
				throw errorHandlerFailure;
			},
		});

		socket.receive([protocol, "event", 1, 1]);
		socket.receive([protocol, "complete", 2]);
		socket.receive([protocol, "reject", 3, { name: "Error", message: "remote failure" }]);

		expect(report).toHaveBeenNthCalledWith(1, listenerFailure);
		expect(report).toHaveBeenNthCalledWith(2, completionFailure);
		expect(report).toHaveBeenNthCalledWith(3, errorHandlerFailure);
		expect(listenerSubscription.active).toBe(true);
		expect(completionSubscription.active).toBe(false);
		expect(errorSubscription.active).toBe(false);

		client.close();
	});

	it("reports unhandled subscription failures", async () => {
		const { client, socket } = await openClient();
		const subscription = client.subscribe("numbers", 0, vi.fn());

		socket.receive([protocol, "reject", 1, { name: "RangeError", message: "remote failure", stack: "remote" }]);

		expect(report).toHaveBeenCalledOnce();
		expect(report).toHaveBeenCalledWith(
			expect.objectContaining({ name: "RangeError", message: "remote failure", stack: "remote" }),
		);
		expect(subscription.active).toBe(false);

		client.close();
	});

	it("propagates cancellation and makes subscription disposal idempotent", async () => {
		const { client, socket } = await openClient();
		const controller = new AbortController();
		const request = client.request("hold", undefined, { signal: controller.signal });
		const subscription = client.subscribe("numbers", 0, vi.fn());

		controller.abort(new DOMException("Stopped", "AbortError"));
		subscription.unsubscribe();
		subscription.unsubscribe();

		await expect(request).rejects.toMatchObject({ name: "AbortError" });
		expect(messages(socket).slice(-2)).toEqual([
			[protocol, "cancel", 1],
			[protocol, "cancel", 2],
		]);
		expect(subscription.active).toBe(false);

		client.close();
	});

	it("rejects uncloneable request values at the call site", async () => {
		const { client } = await openClient();

		await expect(client.request("uncloneable", () => undefined)).rejects.toMatchObject({ name: "DataCloneError" });

		client.close();
	});

	it("fails pending operations when the peer violates the binary protocol", async () => {
		const { client, socket } = await openClient();
		const request = client.request("hold");

		socket.receiveText("not binary");

		await expect(request).rejects.toMatchObject({ name: "ProtocolError" });
		await expect(client.closed).resolves.toBeUndefined();
		expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
	});

	it("closes the protocol and owned WebSocket together", async () => {
		const { client, socket } = await openClient();

		client.close("finished");

		expect(messages(socket).at(-1)).toEqual([
			protocol,
			"close",
			expect.objectContaining({ name: "ConnectionClosedError", message: "finished" }),
		]);
		expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
		await expect(client.closed).resolves.toBeUndefined();
	});

	it("aborts the opening handshake", async () => {
		const controller = new AbortController();
		const pending = connect<TestProtocol>("wss://example.test/socket", { signal: controller.signal });
		const socket = FakeWebSocket.instances.at(-1)!;

		controller.abort(new DOMException("Stopped", "AbortError"));

		await expect(pending).rejects.toMatchObject({ name: "AbortError" });
		expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
	});
});
