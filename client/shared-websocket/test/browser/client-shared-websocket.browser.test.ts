/// <reference lib="dom" />

import { expect, test } from "vitest";
import { connect } from "../../src/lib/scope/window.js";
import type { TestProtocol } from "./shared-websocket.js";

const open = (name: string) => {
	const worker = new SharedWorker(new URL("./shared-websocket.ts", import.meta.url), { name, type: "module" });
	const client = connect<TestProtocol>(worker.port);

	return {
		client,
		close(): void {
			client.close();
			worker.port.close();
		},
	};
};

test("multiplexes page clients over one physical WebSocket", async () => {
	const name = crypto.randomUUID();
	const first = open(name);
	const second = open(name);
	const values = [[] as number[], [] as number[]];
	const subscriptions = [
		first.client.subscribe("values", (value) => values[0]!.push(value)),
		second.client.subscribe("values", (value) => values[1]!.push(value)),
	];

	try {
		expect(await first.client.request("echo", { nested: true })).toEqual({ nested: true });
		expect(await second.client.request("socketCount")).toBe(1);
		await expect.poll(() => first.client.request("subscriberCount")).toBe(2);

		expect(await first.client.request("emit", 7)).toBe(2);
		await expect.poll(() => values).toEqual([[7], [7]]);

		subscriptions[0]!.unsubscribe();
		await expect.poll(() => second.client.request("subscriberCount")).toBe(1);
		first.close();

		expect(await second.client.request("emit", 9)).toBe(1);
		await expect.poll(() => values[1]).toEqual([7, 9]);
		expect(await second.client.request("socketCount")).toBe(1);
	} finally {
		subscriptions.forEach((subscription) => {
			subscription.unsubscribe();
		});
		first.close();
		second.close();
	}
});
