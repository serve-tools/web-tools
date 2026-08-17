/// <reference lib="esnext.disposable" />

import { listen as listenClient } from "@serve-tools/client-shared-event-source/scope/shared-worker";
import type { EventMessage, SharedEventSourceClient } from "@serve-tools/client-shared-event-source/scope/window";
import { connect as connectClient } from "@serve-tools/client-shared-event-source/scope/window";
import { expect, test } from "vitest";
import { listen } from "../src/scope/shared-worker.js";
import { connect, observe } from "../src/signal-shared-event-source.js";

test("re-exports both sides of the shared EventSource client", () => {
	expect(connect).toBe(connectClient);
	expect(listen).toBe(listenClient);
});

test("observes a shared EventSource event together with its ID", () => {
	let emit = (_event: EventMessage<number>): void => {};

	const unsubscribe = (): void => {};
	const client = {
		subscribe(_name: string, listener: (event: EventMessage<number>) => void) {
			emit = listener;

			return { active: true, unsubscribe, [Symbol.dispose]: unsubscribe };
		},
	} as unknown as SharedEventSourceClient<{ count: number }>;
	const observation = observe(client, "count");

	emit({ type: "count", data: 6, lastEventId: "6", origin: "test" });

	expect(observation.get()).toEqual({
		status: "ready",
		event: { type: "count", data: 6, lastEventId: "6", origin: "test" },
	});

	observation.dispose();
});
