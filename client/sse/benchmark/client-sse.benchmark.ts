import { expect, test } from "vitest";

import { createHandler } from "../../../server/sse/src/server-sse.js";
import { benchmark } from "../../benchmark.js";
import { connect } from "../src/client-sse.js";

interface Protocol {
	requests: { echo(value: number): number };
	subscriptions: { ready(value: number): number };
}

const server = createHandler<Protocol>({
	requests: { echo: (value) => value },
	subscriptions: {
		ready: (value, { emit, complete }) => {
			emit(value);
			complete();
		},
	},
});
const client = connect<Protocol>("https://benchmark.invalid/realtime", {
	fetch: (input, init) => server(new Request(input, init)),
});

test("Fetch request and event-stream subscription loopback", async () => {
	expect(await client.request("echo", 42)).toBe(42);

	await benchmark(
		"client-sse/request-loopback",
		async () => {
			await client.request("echo", 42);
		},
		{ iterations: 1_000 },
	);

	await benchmark(
		"client-sse/subscription-open-event-complete-loopback",
		() =>
			new Promise<void>((resolve, reject) => {
				client.subscribe("ready", 42, () => undefined, { onComplete: resolve, onError: reject });
			}),
		{ iterations: 1_000 },
	);

	client.close();
});
