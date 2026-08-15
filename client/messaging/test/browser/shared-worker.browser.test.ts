/// <reference lib="dom" />

import { expect, test, vi } from "vitest";

import { protocol } from "../../src/lib/.internals.js";
import { SharedWorker } from "../../src/scope/window.js";
import type { SharedCounterProtocol } from "./shared-worker.js";

const open = (name: string) => {
	const worker = new SharedWorker<SharedCounterProtocol>(new URL("./shared-worker.ts", import.meta.url), {
		name,
		type: "module",
	});

	return {
		client: worker.client,
		port: worker.port,
		close(): void {
			worker.client.close();
			worker.port.close();
		},
	};
};

test("coordinates independent clients through one shared worker", async () => {
	const sharedName = crypto.randomUUID();
	const connections = [open(sharedName), open(sharedName)];
	const [first, second] = connections;
	const observed = [[] as number[], [] as number[]];
	const subscriptions = [
		first.client.subscribe("totals", (value) => observed[0].push(value)),
		second.client.subscribe("totals", (value) => observed[1].push(value)),
	];

	try {
		expect(
			await Promise.all([first.client.request("echo", "first"), second.client.request("echo", "second")]),
		).toEqual(["first", "second"]);

		await expect.poll(() => first.client.request("subscriberCount")).toBe(2);

		expect(await first.client.request("increment", 2)).toBe(2);
		expect(await second.client.request("increment", 3)).toBe(5);

		await expect
			.poll(() => observed)
			.toEqual([
				[0, 2, 5],
				[0, 2, 5],
			]);

		const input = new Uint8Array([4, 8, 15, 16, 23, 42]);
		const output = await first.client.request("transfer", input.buffer, { transfer: [input.buffer] });

		expect(input.byteLength).toBe(0);
		expect([...new Uint8Array(output)]).toEqual([4, 8, 15, 16, 23, 42]);

		await expect(second.client.request("fail")).rejects.toMatchObject({
			name: "TypeError",
			message: "browser failure",
		});

		const controller = new AbortController();
		const held = second.client.request("hold", undefined, { signal: controller.signal });

		controller.abort();

		await expect(held).rejects.toMatchObject({ name: "AbortError" });
		await expect.poll(() => first.client.request("cancellationCount")).toBe(1);

		subscriptions.forEach((subscription) => {
			subscription.unsubscribe();
		});

		await expect.poll(() => first.client.request("subscriberCount")).toBe(0);
	} finally {
		subscriptions.forEach((subscription) => {
			subscription.unsubscribe();
		});
		connections.forEach((connection) => {
			connection.close();
		});
	}
});

test("cleans up a client whose liveness lease is released without a protocol close", async () => {
	const sharedName = crypto.randomUUID();
	const observer = open(sharedName);
	const priorLeases = await vi.waitFor(async () => {
		const { held } = await navigator.locks.query();
		const leases = held?.filter((lock) => lock.name?.startsWith(`${protocol}#`)) ?? [];

		expect(leases.length).toBeGreaterThan(0);

		return new Set(leases.map((lock) => lock.name));
	});
	const abandoned = open(sharedName);
	const subscription = abandoned.client.subscribe("totals", () => {});

	try {
		await expect.poll(() => observer.client.request("subscriberCount")).toBe(1);

		const name = await vi.waitFor(async () => {
			const { held } = await navigator.locks.query();
			const lease = held?.find((lock) => lock.name?.startsWith(`${protocol}#`) && !priorLeases.has(lock.name));

			expect(lease?.name).toBeDefined();

			return lease?.name as string;
		});

		abandoned.port.close();

		await navigator.locks.request(name, { steal: true }, () => {});

		await expect.poll(() => observer.client.request("subscriberCount")).toBe(0);
	} finally {
		subscription.unsubscribe();
		abandoned.client.close();
		observer.close();
	}
});
