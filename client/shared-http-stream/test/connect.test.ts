import { serve } from "@serve-tools/client-messaging";
import { expect, test, vi } from "vitest";
import { connect } from "../src/lib/connect.js";

type BridgeProtocol = {
	requests: { request(input: { name: string; input: unknown }): unknown };
	subscriptions: { subscribe(input: { name: string; input: unknown }): unknown };
};

test("forwards requests and subscriptions over a message port", async () => {
	const channel = new MessageChannel();
	const server = serve<BridgeProtocol>(channel.port1, {
		requests: { request: ({ name, input }: { name: string; input: unknown }) => ({ name, input }) },
		subscriptions: {
			subscribe: ({ input }, { emit, complete }) => {
				emit(input);
				complete();
			},
		},
	});
	const client = connect<{
		requests: { echo(value: number): { name: string; input: number } };
		subscriptions: { value(input: number): number };
	}>(channel.port2);
	const values: number[] = [];

	try {
		await expect(client.request("echo", 2)).resolves.toEqual({ name: "echo", input: 2 });
		client.subscribe("value", 3, (value) => values.push(value));
		await vi.waitFor(() => expect(values).toEqual([3]));
	} finally {
		client.close();
		server.close();
		channel.port1.close();
		channel.port2.close();
	}
});
