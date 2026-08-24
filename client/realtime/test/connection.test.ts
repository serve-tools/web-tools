import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import { describe, expect, it, vi } from "vitest";

import { createClient } from "../src/client-realtime.js";

interface TestProtocol {
	requests: { double(value: number): number };
	subscriptions: { count(from: number): number };
}

describe("createClient", () => {
	it("dispatches request and subscription settlements", async () => {
		let client!: createClient.Connection<TestProtocol>;
		const transport = {
			send(payload: ArrayBuffer) {
				const message = deserialize(payload);

				if (!Array.isArray(message) || message[0] !== protocol) {
					throw new TypeError("Unexpected message");
				}

				if (message[1] === "request") {
					client.receive(serialize([protocol, "resolve", message[2], Number(message[4]) * 2]));
				} else if (message[1] === "subscribe") {
					client.receive(serialize([protocol, "event", message[2], Number(message[4])]));
					client.receive(serialize([protocol, "complete", message[2]]));
				}
			},
			close() {},
		};

		client = createClient<TestProtocol>(transport);

		await expect(client.request("double", 4)).resolves.toBe(8);

		const values: number[] = [];
		const completed = Promise.withResolvers<void>();

		client.subscribe("count", 3, (value) => values.push(value), { onComplete: completed.resolve });
		await completed.promise;

		expect(values).toEqual([3]);
	});

	it("bounds declared resizable buffer capacity before dispatching a peer message", async () => {
		const close = vi.fn();
		const client = createClient<{ requests: { hold(): unknown } }>(
			{ send: vi.fn(), close },
			{ maximumMessageLength: 256 },
		);
		const request = client.request("hold");
		const value = new ArrayBuffer(0, { maxByteLength: 1_024 });

		client.receive(serialize([protocol, "resolve", 1, value]));

		await expect(request).rejects.toMatchObject({ name: "ProtocolError" });
		expect(close).toHaveBeenCalledOnce();
	});

	it("rejects a complete peer message above its configured limit", async () => {
		const close = vi.fn();
		const client = createClient({ send: vi.fn(), close }, { maximumMessageLength: 8 });

		client.receive(serialize([protocol, "close", { name: "Error", message: "too large" }]));

		expect(close).toHaveBeenCalledOnce();
	});
});
