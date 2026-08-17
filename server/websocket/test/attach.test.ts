import { deserialize, protocol, serialize, subprotocol } from "@serve-tools/realtime-protocol";
import { describe, expect, it, vi } from "vitest";

import { attach } from "../src/lib/attach.js";
import type { WebSocketLike } from "../src/lib/types.js";

class FakeWebSocket extends EventTarget {
	readonly sent: ArrayBuffer[] = [];
	readonly closes: Array<[number | undefined, string | undefined]> = [];
	readonly protocol = subprotocol;
	binaryType: BinaryType = "blob";
	bufferedAmount = 0;
	readyState = 1;

	send(data: ArrayBuffer): void {
		this.sent.push(data);
	}

	close(code?: number, reason?: string): void {
		this.closes.push([code, reason]);
		this.readyState = 2;
	}

	receive(data: unknown): void {
		this.dispatchEvent(new MessageEvent("message", { data }));
	}
}

describe("attach", () => {
	it("maps WHATWG messages and physical closure onto the core", async () => {
		interface Protocol {
			requests: { ping(): string };
		}

		const socket = new FakeWebSocket();
		const connection = attach<Protocol, { user: string }>(
			socket as unknown as WebSocketLike,
			{ requests: { ping: () => "pong" } },
			{ user: "ada" },
		);

		expect(socket.binaryType).toBe("arraybuffer");

		socket.receive(serialize([protocol, "request", 1, "ping", undefined]));
		await Promise.resolve();
		await Promise.resolve();

		expect(socket.sent.map((payload) => deserialize(payload))).toEqual([[protocol, "resolve", 1, "pong"]]);
		expect(connection.context).toEqual({ user: "ada" });

		socket.dispatchEvent(Object.assign(new Event("close"), { code: 1006, reason: "lost" }));
		await expect(connection.closed).resolves.toBeUndefined();
	});

	it("rejects text messages as protocol failures", () => {
		interface Protocol {
			requests: { ping(): void };
		}

		const socket = new FakeWebSocket();

		attach<Protocol>(socket as unknown as WebSocketLike, { requests: { ping: vi.fn() } }, undefined);
		socket.receive("text");

		expect(socket.sent.map((payload) => deserialize(payload))).toEqual([
			[
				protocol,
				"close",
				expect.objectContaining({ name: "ProtocolError", message: "Expected a binary WebSocket message" }),
			],
		]);
		expect(socket.closes).toEqual([[1002, "Protocol error"]]);
	});
});
