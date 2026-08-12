/// <reference lib="esnext.disposable" />

import {
	connect,
	serve,
	type WorkerClient,
	type WorkerOperation,
	type WorkerServer,
	type WorkerSubscriptionContext,
} from "@serve-tools/client-messaging";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observe } from "../src/signal-messaging.js";

type TestProtocol = {
	requests: Record<never, never>;
	subscriptions: {
		values: WorkerOperation<void, number>;
		labeled: WorkerOperation<{ readonly label: string }, string>;
	};
};

describe("observe", () => {
	let client: WorkerClient<TestProtocol>;
	let clientPort: MessagePort;
	let server: WorkerServer<TestProtocol>;
	let serverPort: MessagePort;
	let valueContext: WorkerSubscriptionContext<number> | undefined;

	beforeEach(() => {
		const { port1, port2 } = new MessageChannel();

		client = connect<TestProtocol>(port1);
		server = serve<TestProtocol>(port2, {
			requests: {},
			subscriptions: {
				values: (_input, context) => {
					valueContext = context;
				},
				labeled: ({ label }, { emit }) => emit(`${label}:ready`),
			},
		});

		clientPort = port1;
		serverPort = port2;
		valueContext = undefined;
	});

	afterEach(() => {
		client.close();
		server.close();
		clientPort.close();
		serverPort.close();
	});

	it("publishes values and remote completion as explicit states", async () => {
		const observation = observe(client, "values");

		expect(observation.get()).toEqual({ status: "pending" });
		expect(observation.active).toBe(true);
		await vi.waitFor(() => expect(valueContext).toBeDefined());

		valueContext?.emit(1);
		await vi.waitFor(() => expect(observation.get()).toEqual({ status: "ready", value: 1 }));

		valueContext?.emit(2);
		await vi.waitFor(() => expect(observation.get()).toEqual({ status: "ready", value: 2 }));

		valueContext?.complete();
		await vi.waitFor(() => expect(observation.get()).toEqual({ status: "complete" }));
		expect(observation.active).toBe(false);
	});

	it("publishes remote errors", async () => {
		const observation = observe(client, "values");

		await vi.waitFor(() => expect(valueContext).toBeDefined());
		valueContext?.error(new TypeError("failed"));
		await vi.waitFor(() =>
			expect(observation.get()).toMatchObject({
				status: "error",
				error: { name: "TypeError", message: "failed" },
			}),
		);
		expect(observation.active).toBe(false);
	});

	it("passes typed input through one options object", async () => {
		const observation = observe(client, "labeled", { input: { label: "job" } });

		await vi.waitFor(() => expect(observation.get()).toEqual({ status: "ready", value: "job:ready" }));
		observation.dispose();
	});

	it("publishes AbortSignal cancellation as an error", async () => {
		const controller = new AbortController();
		const observation = observe(client, "values", { signal: controller.signal });

		await vi.waitFor(() => expect(valueContext).toBeDefined());
		controller.abort(new DOMException("Stopped", "AbortError"));

		expect(observation.get()).toMatchObject({ status: "error", error: { name: "AbortError" } });
		expect(observation.active).toBe(false);
	});

	it("does not subscribe when its signal is already aborted", () => {
		const controller = new AbortController();

		controller.abort("stopped");

		const observation = observe(client, "values", { signal: controller.signal });

		expect(observation.get()).toEqual({ status: "error", error: "stopped" });
		expect(observation.active).toBe(false);
	});

	it("disposes idempotently and freezes the latest state", async () => {
		const observation = observe(client, "values");

		await vi.waitFor(() => expect(valueContext).toBeDefined());
		valueContext?.emit(1);
		await vi.waitFor(() => expect(observation.get()).toEqual({ status: "ready", value: 1 }));

		observation.dispose();
		observation.dispose();
		valueContext?.emit(2);
		await Promise.resolve();

		expect(observation.get()).toEqual({ status: "ready", value: 1 });
		expect(observation.active).toBe(false);
	});
});
