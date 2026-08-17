import { listen as listenClient } from "@serve-tools/client-shared-webtransport/scope/shared-worker";
import type { SharedWebTransportClient } from "@serve-tools/client-shared-webtransport/scope/window";
import { connect as connectClient } from "@serve-tools/client-shared-webtransport/scope/window";
import { expect, test } from "vitest";
import { listen } from "../src/scope/shared-worker.js";
import { connect, observe } from "../src/signal-shared-webtransport.js";

test("re-exports both sides of the shared WebTransport client", () => {
	expect(connect).toBe(connectClient);
	expect(listen).toBe(listenClient);
});

test("observes a shared WebTransport reliable subscription", () => {
	let emit = (_value: number): void => {};

	const unsubscribe = (): void => {};
	const client = {
		subscribe(_name: string, listener: (value: number) => void) {
			emit = listener;

			return { active: true, unsubscribe, [Symbol.dispose]: unsubscribe };
		},
	} as unknown as SharedWebTransportClient<{ subscriptions: { count(): number } }>;
	const observation = observe(client, "count");

	emit(7);

	expect(observation.get()).toEqual({ status: "ready", value: 7 });

	observation.dispose();
});
