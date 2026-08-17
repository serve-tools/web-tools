import { listen as listenClient } from "@serve-tools/client-shared-websocket/scope/shared-worker";
import type { SharedWebSocketClient } from "@serve-tools/client-shared-websocket/scope/window";
import { connect as connectClient } from "@serve-tools/client-shared-websocket/scope/window";
import { expect, test } from "vitest";
import { listen } from "../src/scope/shared-worker.js";
import { connect, observe } from "../src/signal-shared-websocket.js";

test("re-exports both sides of the shared WebSocket client", () => {
	expect(connect).toBe(connectClient);
	expect(listen).toBe(listenClient);
});

test("observes a shared WebSocket client through the common adapter", () => {
	let emit = (_value: number): void => {};

	const unsubscribe = () => {};
	const client = {
		subscribe(_name: string, listener: (value: number) => void) {
			emit = listener;

			return { active: true, unsubscribe, [Symbol.dispose]: unsubscribe };
		},
	} as unknown as SharedWebSocketClient<{ subscriptions: { count(): number } }>;
	const observation = observe(client, "count");

	emit(4);

	expect(observation.get()).toEqual({ status: "ready", value: 4 });

	observation.dispose();
});
