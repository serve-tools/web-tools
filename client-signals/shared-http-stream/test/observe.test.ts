import type { SharedHTTPStreamClient } from "@serve-tools/client-shared-http-stream/scope/window";
import { expect, test } from "vitest";
import { observe } from "../src/signal-shared-http-stream.js";

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
