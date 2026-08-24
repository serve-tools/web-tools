/// <reference lib="dom" />

import { expect, test } from "vitest";
import { connect } from "../../src/lib/scope/window.js";
import type { TestEvents } from "./shared-event-source.js";

const open = (name: string) => {
	const worker = new SharedWorker(new URL("./shared-event-source.ts", import.meta.url), { name, type: "module" });
	const client = connect<TestEvents>(worker.port);

	return { client, worker };
};

test("shares one EventSource while subscriptions and page closure remain independently owned", async () => {
	const name = crypto.randomUUID();
	const first = open(name);
	const second = open(name);
	const values = [[] as number[], [] as number[]];
	const sourceCounts = [[] as number[], [] as number[]];
	const subscriptions = [
		first.client.subscribe("presence", ({ data }) => {
			values[0]!.push(data.sequence);
			sourceCounts[0]!.push(data.sourceCount);
		}),
		second.client.subscribe("presence", ({ data }) => {
			values[1]!.push(data.sequence);
			sourceCounts[1]!.push(data.sourceCount);
		}),
	];

	try {
		await expect.poll(() => values.every((received) => received.length > 0), { timeout: 8_000 }).toBe(true);
		expect(sourceCounts.flat().every((count) => count === 1)).toBe(true);

		const firstValues = [...values[0]];
		const secondCount = values[1].length;

		subscriptions[0]!.unsubscribe();
		await expect.poll(() => values[1].length).toBeGreaterThan(secondCount);
		expect(values[0]).toEqual(firstValues);

		first.client.close();
		await expect(first.client.closed).resolves.toBeUndefined();
		await expect.poll(() => values[1].length).toBeGreaterThan(secondCount + 1);
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
