import type { WebTransportBidirectionalStreamLike } from "@serve-tools/client-webtransport";
import { subprotocol } from "@serve-tools/realtime-protocol";
import { afterEach, expect, test, vi } from "vitest";
import { connect } from "../src/lib/connect.js";
import { listen } from "../src/lib/listen.js";

interface TestProtocol {
	requests: { ping(): string };
}

class FailingWebTransport {
	static instance: FailingWebTransport;
	readonly ready = Promise.resolve();
	readonly #closed = Promise.withResolvers<void>();
	readonly closed = this.#closed.promise;
	readonly protocol = subprotocol;
	readonly datagrams = {
		readable: new ReadableStream<Uint8Array>(),
		maxDatagramSize: 1_200,
		createWritable: () => new WritableStream<BufferSource>(),
	};
	closeInfo: { readonly closeCode?: number; readonly reason?: string } | undefined;
	#streams = 0;

	constructor() {
		FailingWebTransport.instance = this;
	}

	async createBidirectionalStream(): Promise<WebTransportBidirectionalStreamLike> {
		if (++this.#streams === 2) {
			throw new Error("registry setup failed");
		}

		return {
			readable: new ReadableStream<Uint8Array>(),
			writable: new WritableStream<BufferSource>(),
		};
	}

	close(info?: { readonly closeCode?: number; readonly reason?: string }): void {
		this.closeInfo = info;
		this.#closed.resolve();
	}
}

const originalOnconnect = Object.getOwnPropertyDescriptor(globalThis, "onconnect");
const originalAddEventListener = Object.getOwnPropertyDescriptor(globalThis, "addEventListener");
const originalRemoveEventListener = Object.getOwnPropertyDescriptor(globalThis, "removeEventListener");

afterEach(() => {
	restore("onconnect", originalOnconnect);
	restore("addEventListener", originalAddEventListener);
	restore("removeEventListener", originalRemoveEventListener);
});

test("closes shared page servers when WebTransport setup fails after ready", async () => {
	let connected: ((event: { readonly ports: readonly MessagePort[] }) => void) | undefined;

	Object.defineProperties(globalThis, {
		onconnect: { configurable: true, value: null },
		addEventListener: {
			configurable: true,
			value: (type: string, listener: typeof connected) => {
				if (type === "connect") {
					connected = listener;
				}
			},
		},
		removeEventListener: { configurable: true, value: vi.fn() },
	});

	const server = listen<TestProtocol>("https://example.test/realtime", {
		transportConstructor: FailingWebTransport,
	});
	const channel = new MessageChannel();

	connected!({ ports: [channel.port1] });

	const client = connect<TestProtocol>(channel.port2);

	try {
		await server.closed;
		await client.closed;

		expect(FailingWebTransport.instance.closeInfo?.reason).toBe("Connection setup failed");
	} finally {
		server.close();
		client.close();
		channel.port1.close();
		channel.port2.close();
	}
});

const restore = (name: string, descriptor: PropertyDescriptor | undefined): void => {
	if (descriptor) {
		Object.defineProperty(globalThis, name, descriptor);
	} else {
		Reflect.deleteProperty(globalThis, name);
	}
};
