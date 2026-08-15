import type { Client } from "@serve-tools/client-websocket";
import { expect, test, vi } from "vitest";
import { observe } from "../src/signal-websocket.js";

test("observes a WebSocket subscription without adding runtime machinery", () => {
	let next = (_value: number): void => {};
	const unsubscribe = vi.fn();
	const client = {
		subscribe(_name: string, listener: (value: number) => void) {
			next = listener;

			return { active: true, unsubscribe, [Symbol.dispose]: unsubscribe };
		},
	} as unknown as Client<{ subscriptions: { count(): number } }>;
	const observation = observe(client, "count");

	expect(observation.get()).toEqual({ status: "pending" });
	next(3);
	expect(observation.get()).toEqual({ status: "ready", value: 3 });
	observation.dispose();
	expect(unsubscribe).toHaveBeenCalledOnce();
});
