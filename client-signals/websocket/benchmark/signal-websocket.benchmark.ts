import type { Client } from "@serve-tools/client-websocket";
import { test } from "vitest";
import { benchmark } from "../../../client/benchmark.js";
import { observe } from "../src/signal-websocket.js";

test("creates and disposes WebSocket observations", async () => {
	const unsubscribe = () => {};
	const client = {
		subscribe: () => ({ active: true, unsubscribe, [Symbol.dispose]: unsubscribe }),
	} as unknown as Client<{ subscriptions: { value(): number } }>;

	await benchmark("signal-websocket/observe-dispose", () => observe(client, "value").dispose(), {
		iterations: 1_000,
	});
});
