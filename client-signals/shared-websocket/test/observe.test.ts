import type { SharedWebSocketClient } from "@serve-tools/client-shared-websocket/scope/window";
import { expect, test } from "vitest";
import { observe } from "../src/signal-shared-websocket.js";

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
