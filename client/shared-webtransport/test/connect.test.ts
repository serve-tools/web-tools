import { serve } from "@serve-tools/client-messaging";
import { expect, test, vi } from "vitest";
import { connect } from "../src/lib/connect.js";

type BridgeProtocol = {
	requests: {
		request(input: { name: string; input: unknown }): unknown;
		datagramWrite(input: { name: string; value: unknown }): void;
		datagramMaximumSize(): number;
	};
	subscriptions: {
		subscribe(input: { name: string; input: unknown }): unknown;
		datagramSubscribe(input: { name: string }): unknown;
	};
};

test("forwards operations and datagrams over a message port", async () => {
	const channel = new MessageChannel();
	const written: unknown[] = [];
	const server = serve<BridgeProtocol>(channel.port1, {
		requests: {
			request: ({ input }: { input: unknown }) => input,
			datagramWrite: ({ value }: { value: unknown }) => void written.push(value),
			datagramMaximumSize: () => 1200,
		},
		subscriptions: {
			subscribe: (_input: unknown, { complete }) => complete(),
			datagramSubscribe: (_input: unknown, { emit }) => emit({ x: 1 }),
		},
	});
	const client = connect<{
		requests: { echo(value: number): number };
		subscriptions: { events(): number };
		datagrams: { cursor: { client: { x: number }; server: { x: number } } };
	}>(channel.port2);
	const values: unknown[] = [];

	try {
		await expect(client.request("echo", 2)).resolves.toBe(2);
		await expect(client.datagrams.maxDatagramSize).resolves.toBe(1200);
		await client.datagrams.write("cursor", { x: 2 });
		client.datagrams.subscribe("cursor", (value) => values.push(value));
		await vi.waitFor(() => expect(values).toEqual([{ x: 1 }]));
		expect(written).toEqual([{ x: 2 }]);
	} finally {
		client.close();
		server.close();
		channel.port1.close();
		channel.port2.close();
	}
});
