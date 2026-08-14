/// <reference lib="dom" />

import { expect, test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { connect, serve, transfer } from "../src/client-messaging.js";

interface Protocol {
	requests: {
		echo(value: number): number;
		echoWithSignal(value: number): number;
		transfer(value: ArrayBuffer): ArrayBuffer;
	};
	subscriptions: {
		events(): number;
		ready(value: number): number;
	};
}

test("MessagePort request round trips", async () => {
	const channel = new MessageChannel();
	const server = serve<Protocol>(channel.port1, {
		requests: {
			echo: (value) => value,
			echoWithSignal: (value, { signal }) => {
				if (signal.aborted) throw signal.reason;
				return value;
			},
			transfer: (value) => transfer(value, [value]),
		},
		subscriptions: {
			events: () => undefined,
			ready: (value, { emit }) => emit(value),
		},
	});
	const client = connect<Protocol>(channel.port2);

	try {
		expect(await client.request("echo", 42)).toBe(42);

		await benchmark(
			"client-messaging/request-round-trip",
			async () => {
				await client.request("echo", 42);
			},
			{ iterations: 10_000 },
		);

		await benchmark(
			"client-messaging/request-round-trip-with-signal",
			async () => {
				await client.request("echoWithSignal", 42);
			},
			{ iterations: 10_000 },
		);

		await benchmark(
			"client-messaging/transfer-1-mib",
			async () => {
				const input = new ArrayBuffer(1024 * 1024);
				const output = await client.request("transfer", input, { transfer: [input] });

				if (output.byteLength !== 1024 * 1024) throw new Error("Unexpected transferred buffer size");
			},
			{ iterations: 200, samples: 10, warmup: 3 },
		);
	} finally {
		client.close();
		server.close();
		channel.port1.close();
		channel.port2.close();
	}
});

test("MessagePort subscription delivery", async () => {
	const channel = new MessageChannel();
	const started = Promise.withResolvers<(value: number) => void>();
	const server = serve<Protocol>(channel.port1, {
		requests: {
			echo: (value) => value,
			echoWithSignal: (value) => value,
			transfer: (value) => transfer(value, [value]),
		},
		subscriptions: {
			events: (_input, { emit }) => started.resolve(emit),
			ready: (value, { emit }) => emit(value),
		},
	});
	const client = connect<Protocol>(channel.port2);
	let received = Promise.withResolvers<void>();
	const subscription = client.subscribe("events", () => received.resolve());
	const emit = await started.promise;

	try {
		await benchmark(
			"client-messaging/subscription-event",
			async () => {
				received = Promise.withResolvers<void>();
				emit(42);
				await received.promise;
			},
			{ iterations: 10_000 },
		);

		await benchmark(
			"client-messaging/subscription-open-event-cancel",
			async () => {
				const delivered = Promise.withResolvers<void>();
				const handle = client.subscribe("ready", 42, () => delivered.resolve());

				await delivered.promise;
				handle.unsubscribe();
			},
			{ iterations: 5_000 },
		);
	} finally {
		subscription.unsubscribe();
		client.close();
		server.close();
		channel.port1.close();
		channel.port2.close();
	}
});
