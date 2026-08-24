/// <reference lib="dom" />

import { expect, test } from "vitest";
import { connect } from "../../src/lib/scope/window.js";
import type { TestProtocolType } from "./shared-http-stream.js";

const open = (name: string) => {
	const worker = new SharedWorker(new URL("./shared-http-stream.ts", import.meta.url), { name, type: "module" });
	const client = connect<TestProtocolType>(worker.port);

	return { client, worker };
};

test("shares worker-owned HTTP exchanges while cancellation and page closure propagate to the right owners", async () => {
	const name = crypto.randomUUID();
	const first = open(name);
	const second = open(name);
	const values = [[] as number[], [] as number[]];
	const subscriptions = [
		first.client.subscribe("values", (value) => values[0]!.push(value)),
		second.client.subscribe("values", (value) => values[1]!.push(value)),
	];

	try {
		expect(await first.client.request("sourceCount")).toBe(1);
		await expect.poll(() => second.client.request("subscriberCount")).toBe(2);
		expect(await first.client.request("emit", 7)).toBe(2);
		await expect.poll(() => values).toEqual([[7], [7]]);

		subscriptions[0]!.unsubscribe();
		await expect.poll(() => second.client.request("subscriberCount")).toBe(1);
		first.client.close();
		await expect(first.client.closed).resolves.toBeUndefined();
		expect(await second.client.request("emit", 9)).toBe(1);
		await expect.poll(() => values[1]).toEqual([7, 9]);

		second.client.close();
		await expect(second.client.closed).resolves.toBeUndefined();
	} finally {
		for (const subscription of subscriptions) {
			subscription.unsubscribe();
		}
		first.client.close();
		second.client.close();
		first.worker.port.close();
		second.worker.port.close();
	}
});
