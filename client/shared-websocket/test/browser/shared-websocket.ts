/// <reference lib="webworker" />

import { deserialize, protocol, serialize, subprotocol } from "@serve-tools/realtime-protocol";
import { listen } from "../../src/lib/scope/shared-worker.js";

class LoopbackWebSocket extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	static count = 0;

	readonly subscriptions = new Set<number>();
	binaryType: BinaryType = "blob";
	readonly protocol = subprotocol;
	readyState = LoopbackWebSocket.CONNECTING;

	constructor() {
		super();

		++LoopbackWebSocket.count;

		queueMicrotask(() => {
			this.readyState = LoopbackWebSocket.OPEN;
			this.dispatchEvent(new Event("open"));
		});
	}

	send(data: ArrayBuffer): void {
		const message = deserialize(data) as [string, string, number?, string?, unknown?];
		const [, kind, id, name, input] = message;

		if (kind === "close") {
			this.close();

			return;
		}

		if (kind === "cancel") {
			this.subscriptions.delete(id!);

			return;
		}

		if (kind === "subscribe") {
			this.subscriptions.add(id!);

			return;
		}

		let output = input;

		if (name === "socketCount") {
			output = LoopbackWebSocket.count;
		} else if (name === "subscriberCount") {
			output = this.subscriptions.size;
		} else if (name === "emit") {
			for (const subscriptionId of this.subscriptions) {
				this.receive([protocol, "event", subscriptionId, input]);
			}

			output = this.subscriptions.size;
		}

		this.receive([protocol, "resolve", id, output]);
	}

	close(): void {
		if (this.readyState === LoopbackWebSocket.CLOSED) {
			return;
		}

		this.readyState = LoopbackWebSocket.CLOSED;

		this.dispatchEvent(Object.assign(new Event("close"), { code: 1000, reason: "", wasClean: true }));
	}

	private receive(message: unknown): void {
		this.dispatchEvent(new MessageEvent("message", { data: serialize(message) }));
	}
}

Object.assign(globalThis, { WebSocket: LoopbackWebSocket });

const server = listen<{
	requests: {
		echo(value: unknown): unknown;
		socketCount(): number;
		subscriberCount(): number;
		emit(value: number): number;
	};
	subscriptions: {
		values(): number;
	};
}>("wss://loopback.test/socket");

export type TestProtocol = listen.ProtocolType<typeof server>;
