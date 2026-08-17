import type { Client } from "@serve-tools/client-webtransport";
import { expect, test } from "vitest";
import { observe } from "../src/signal-webtransport.js";

test("observes a reliable WebTransport subscription", () => {
	let emit = (_value: number): void => {};
	const unsubscribe = (): void => {};
	const client = {
		subscribe(_name: string, listener: (value: number) => void) {
			emit = listener;

			return { active: true, unsubscribe, [Symbol.dispose]: unsubscribe };
		},
	} as unknown as Client<{ subscriptions: { count(): number } }>;
	const observation = observe(client, "count");

	emit(5);
	expect(observation.get()).toEqual({ status: "ready", value: 5 });
	observation.dispose();
});
