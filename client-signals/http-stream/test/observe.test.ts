import type { Client } from "@serve-tools/client-http-stream";
import { connect as connectClient } from "@serve-tools/client-http-stream";
import { expect, test } from "vitest";
import { connect, observe } from "../src/signal-http-stream.js";

test("re-exports the HTTP stream client", () => {
	expect(connect).toBe(connectClient);
});

test("observes an HTTP streaming subscription through the common adapter", () => {
	let emit = (_value: number): void => {};
	const unsubscribe = (): void => {};
	const client = {
		subscribe(_name: string, listener: (value: number) => void) {
			emit = listener;

			return { active: true, unsubscribe, [Symbol.dispose]: unsubscribe };
		},
	} as unknown as Client<{ subscriptions: { count(): number } }>;
	const observation = observe(client, "count");

	emit(4);
	expect(observation.get()).toEqual({ status: "ready", value: 4 });
	observation.dispose();
});
