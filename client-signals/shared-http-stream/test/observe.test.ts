import { listen as listenClient } from "@serve-tools/client-shared-http-stream/scope/shared-worker";
import type { SharedHTTPStreamClient } from "@serve-tools/client-shared-http-stream/scope/window";
import { connect as connectClient } from "@serve-tools/client-shared-http-stream/scope/window";
import { expect, test } from "vitest";
import { listen } from "../src/scope/shared-worker.js";
import { connect, observe } from "../src/signal-shared-http-stream.js";

test("re-exports both sides of the shared HTTP stream client", () => {
	expect(connect).toBe(connectClient);
	expect(listen).toBe(listenClient);
});

test("observes a shared HTTP stream client", () => {
	let emit = (_value: number): void => {};

	const unsubscribe = (): void => {};
	const client = {
		subscribe(_name: string, listener: (value: number) => void) {
			emit = listener;

			return { active: true, unsubscribe, [Symbol.dispose]: unsubscribe };
		},
	} as unknown as SharedHTTPStreamClient<{ subscriptions: { count(): number } }>;
	const observation = observe(client, "count");

	emit(6);

	expect(observation.get()).toEqual({ status: "ready", value: 6 });

	observation.dispose();
});
