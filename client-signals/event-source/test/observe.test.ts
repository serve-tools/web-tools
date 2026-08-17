import type { Client, EventMessage } from "@serve-tools/client-event-source";
import { connect as connectClient } from "@serve-tools/client-event-source";
import { expect, test } from "vitest";
import { connect, observe } from "../src/signal-event-source.js";

test("re-exports the EventSource client", () => {
	expect(connect).toBe(connectClient);
});

test("observes event data together with its ID", () => {
	let emit = (_event: EventMessage<number>): void => {};

	const unsubscribe = (): void => {};
	const client = {
		subscribe(_name: string, listener: (event: EventMessage<number>) => void) {
			emit = listener;

			return { active: true, unsubscribe, [Symbol.dispose]: unsubscribe };
		},
	} as unknown as Client<{ count: number }>;
	const observation = observe(client, "count");

	emit({ type: "count", data: 4, lastEventId: "4", origin: "test" });

	expect(observation.get()).toEqual({
		status: "ready",
		event: { type: "count", data: 4, lastEventId: "4", origin: "test" },
	});

	observation.dispose();
});
