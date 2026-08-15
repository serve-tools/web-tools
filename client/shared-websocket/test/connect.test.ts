import { serve } from "@serve-tools/client-messaging";
import { expect, test, vi } from "vitest";
import { connect } from "../src/lib/connect.js";

type BridgeProtocol = {
	requests: { request(input: { name: string; input: unknown }): unknown };
	subscriptions: { subscribe(input: { name: string; input: unknown }): unknown };
};

test("forwards typed requests and subscriptions over a message port", async () => {
	const channel = new MessageChannel();
	const server = serve<BridgeProtocol>(channel.port1, {
		requests: { request: ({ name, input }) => ({ name, input }) },
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
	const complete = vi.fn();

	try {
		await expect(client.request("echo", 2)).resolves.toEqual({ name: "echo", input: 2 });
		client.subscribe("value", 3, (value) => values.push(value), { onComplete: complete });
		await vi.waitFor(() => expect(values).toEqual([3]));
		expect(complete).toHaveBeenCalledOnce();
	} finally {
		client.close();
		server.close();
		channel.port1.close();
		channel.port2.close();
	}
});
