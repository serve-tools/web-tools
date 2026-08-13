/// <reference lib="esnext.disposable" />

import { describe, expect, it, vi } from "vitest";

import {
	connect,
	serve,
	transfer,
	type WorkerHandlers,
	type WorkerOperation,
	type WorkerProtocol,
	WorkerRemoteError,
	type WorkerRequestContext,
} from "../src/client-messaging.js";

const open = <P extends WorkerProtocol>(handlers: WorkerHandlers<P>) => {
	const { port1, port2 } = new MessageChannel();
	const client = connect<P>(port1);
	const server = serve<P>(port2, handlers);

	return {
		client,
		server,
		close(): void {
			client.close();
			server.close();
			port1.close();
			port2.close();
		},
	};
};

describe("requests", () => {
	it("correlates concurrent requests and preserves remote errors", async () => {
		type P = {
			requests: {
				add: WorkerOperation<{ a: number; b: number }, number>;
				fail: WorkerOperation<void, never>;
			};
			subscriptions: Record<never, never>;
		};
		const connection = open<P>({
			requests: {
				add: async ({ a, b }) => {
					await Promise.resolve();
					return a + b;
				},
				fail: () => {
					throw new TypeError("expected failure");
				},
			},
			subscriptions: {},
		});

		try {
			expect(
				await Promise.all([
					connection.client.request("add", { a: 1, b: 2 }),
					connection.client.request("add", { a: 10, b: 5 }),
				]),
			).toEqual([3, 15]);

			await expect(connection.client.request("fail")).rejects.toMatchObject({
				name: "TypeError",
				message: "expected failure",
			});
		} finally {
			connection.close();
		}
	});

	it("transfers values in both directions", async () => {
		type P = {
			requests: { echo: WorkerOperation<ArrayBuffer, ArrayBuffer> };
			subscriptions: Record<never, never>;
		};
		const connection = open<P>({
			requests: { echo: (buffer) => transfer(buffer, [buffer]) },
			subscriptions: {},
		});
		const input = new Uint8Array([4, 8, 15, 16, 23, 42]);

		try {
			const output = await connection.client.request("echo", input.buffer, { transfer: [input.buffer] });

			expect(input.byteLength).toBe(0);
			expect([...new Uint8Array(output)]).toEqual([4, 8, 15, 16, 23, 42]);
		} finally {
			connection.close();
		}
	});

	it("rejects when a response cannot be structured-cloned", async () => {
		type P = {
			requests: { uncloneable: WorkerOperation<void, unknown> };
			subscriptions: Record<never, never>;
		};
		const connection = open<P>({
			requests: { uncloneable: () => () => undefined },
			subscriptions: {},
		});

		try {
			await expect(connection.client.request("uncloneable")).rejects.toMatchObject({ name: "DataCloneError" });
		} finally {
			connection.close();
		}
	});

	it("propagates AbortSignal cancellation to a running handler", async () => {
		type P = {
			requests: { hold: WorkerOperation<void, never> };
			subscriptions: Record<never, never>;
		};
		const aborted = Promise.withResolvers<void>();
		const connection = open<P>({
			requests: {
				hold: (_input, { signal }) =>
					new Promise((_resolve, reject) => {
						signal.addEventListener(
							"abort",
							() => {
								aborted.resolve();
								reject(signal.reason);
							},
							{ once: true },
						);
					}),
			},
			subscriptions: {},
		});
		const controller = new AbortController();
		const request = connection.client.request("hold", undefined, { signal: controller.signal });

		controller.abort();

		try {
			await expect(request).rejects.toMatchObject({ name: "AbortError" });
			await aborted.promise;
		} finally {
			connection.close();
		}
	});

	it("creates operation signals only when handlers observe them", async () => {
		type P = {
			requests: {
				ignored: WorkerOperation<number, number>;
				late: WorkerOperation<void, void>;
				observed: WorkerOperation<void, boolean>;
			};
			subscriptions: Record<never, never>;
		};

		const NativeAbortController = AbortController;

		let constructions = 0;
		let lateContext: WorkerRequestContext | undefined;

		class CountingAbortController extends NativeAbortController {
			constructor() {
				super();

				++constructions;
			}
		}

		vi.stubGlobal("AbortController", CountingAbortController);

		const connection = open<P>({
			requests: {
				ignored: (value) => value,
				late: (_input, context) => {
					lateContext = context;
				},
				observed: (_input, { signal }) => signal.aborted,
			},
			subscriptions: {},
		});

		try {
			expect(await connection.client.request("ignored", 42)).toBe(42);
			expect(constructions).toBe(0);
			expect(await connection.client.request("observed")).toBe(false);
			expect(constructions).toBe(1);

			await connection.client.request("late");

			expect(constructions).toBe(1);

			const lateSignal = lateContext!.signal;

			expect(lateSignal.aborted).toBe(true);
			expect(lateContext!.signal).toBe(lateSignal);
			expect(constructions).toBe(2);
		} finally {
			connection.close();
			vi.unstubAllGlobals();
		}
	});
});

describe("subscriptions", () => {
	it("delivers ordered values, completes, and runs cleanup once", async () => {
		type P = {
			requests: Record<never, never>;
			subscriptions: { numbers: WorkerOperation<{ start: number }, number> };
		};

		const cleanup = vi.fn();
		const completed = Promise.withResolvers<void>();
		const connection = open<P>({
			requests: {},
			subscriptions: {
				numbers: ({ start }, { emit, complete }) => {
					emit(start);
					queueMicrotask(() => {
						emit(start + 1);
						complete();
					});
					return cleanup;
				},
			},
		});
		const values: number[] = [];
		const subscription = connection.client.subscribe("numbers", { start: 3 }, (value) => values.push(value), {
			onComplete: completed.resolve,
		});

		try {
			await completed.promise;

			expect(values).toEqual([3, 4]);
			expect(subscription.active).toBe(false);
			expect(cleanup).toHaveBeenCalledOnce();
		} finally {
			connection.close();
		}
	});

	it("uses explicit disposal to cancel and clean up", async () => {
		type P = {
			requests: Record<never, never>;
			subscriptions: { hold: WorkerOperation<void, void> };
		};

		const cleaned = Promise.withResolvers<boolean>();
		const connection = open<P>({
			requests: {},
			subscriptions: {
				hold: async (_input, { signal }) => {
					await Promise.resolve();
					return () => cleaned.resolve(signal.aborted);
				},
			},
		});
		const subscription = connection.client.subscribe("hold", noop);

		subscription[Symbol.dispose]();
		subscription.unsubscribe();

		try {
			expect(await cleaned.promise).toBe(true);
			expect(subscription.active).toBe(false);
		} finally {
			connection.close();
		}
	});

	it("transfers subscription events", async () => {
		type P = {
			requests: Record<never, never>;
			subscriptions: { chunk: WorkerOperation<void, ArrayBuffer> };
		};

		const completed = Promise.withResolvers<void>();
		const connection = open<P>({
			requests: {},
			subscriptions: {
				chunk: (_input, { emit, complete }) => {
					const bytes = new Uint8Array([7, 9]);
					emit(transfer(bytes.buffer, [bytes.buffer]));
					complete();
				},
			},
		});
		const values: number[][] = [];

		connection.client.subscribe("chunk", (value) => values.push([...new Uint8Array(value)]), {
			onComplete: completed.resolve,
		});

		try {
			await completed.promise;

			expect(values).toEqual([[7, 9]]);
		} finally {
			connection.close();
		}
	});

	it("fails and cleans up when an event cannot be structured-cloned", async () => {
		type P = {
			requests: Record<never, never>;
			subscriptions: { uncloneable: WorkerOperation<void, unknown> };
		};

		const cleanup = vi.fn();
		const failed = Promise.withResolvers<Error>();
		const connection = open<P>({
			requests: {},
			subscriptions: {
				uncloneable: (_input, { emit }) => {
					emit(() => undefined);
					return cleanup;
				},
			},
		});

		connection.client.subscribe("uncloneable", noop, { onError: failed.resolve });

		try {
			expect(await failed.promise).toMatchObject({ name: "DataCloneError" });
			expect(cleanup).toHaveBeenCalledOnce();
		} finally {
			connection.close();
		}
	});

	it("rethrows unhandled subscription failures through a microtask", async () => {
		type P = {
			requests: Record<never, never>;
			subscriptions: { fail: WorkerOperation<void, void> };
		};

		const failure = new Error("expected failure");
		const queued = Promise.withResolvers<VoidFunction>();
		const queue = vi.spyOn(globalThis, "queueMicrotask").mockImplementation(queued.resolve);
		const connection = open<P>({
			requests: {},
			subscriptions: {
				fail: (_input, { error }) => error(failure),
			},
		});

		try {
			connection.client.subscribe("fail", noop);

			expect(await queued.promise).toThrow("expected failure");
		} finally {
			queue.mockRestore();

			connection.close();
		}
	});

	it("does not open operations for signals that are already aborted", async () => {
		type P = {
			requests: { request: WorkerOperation<void, void> };
			subscriptions: { subscription: WorkerOperation<void, void> };
		};

		const request = vi.fn();
		const subscription = vi.fn();
		const connection = open<P>({
			requests: { request },
			subscriptions: { subscription },
		});
		const controller = new AbortController();

		controller.abort();

		try {
			await expect(
				connection.client.request("request", undefined, { signal: controller.signal }),
			).rejects.toMatchObject({
				name: "AbortError",
			});

			const handle = connection.client.subscribe("subscription", noop, { signal: controller.signal });

			expect(handle.active).toBe(false);

			await Promise.resolve();

			expect(request).not.toHaveBeenCalled();
			expect(subscription).not.toHaveBeenCalled();
		} finally {
			connection.close();
		}
	});
});

describe("protocol and lifecycle", () => {
	it("reports unknown and inherited operation names instead of hanging", async () => {
		type P = {
			requests: { missing: WorkerOperation<void, never> };
			subscriptions: { constructor: WorkerOperation<void, never> };
		};

		const connection = open<P>({
			requests: {} as WorkerHandlers<P>["requests"],
			subscriptions: {} as WorkerHandlers<P>["subscriptions"],
		});
		const subscriptionError = Promise.withResolvers<Error>();

		try {
			connection.client.subscribe("constructor", noop, { onError: subscriptionError.resolve });

			await expect(connection.client.request("missing")).rejects.toBeInstanceOf(WorkerRemoteError);
			await expect(connection.client.request("missing")).rejects.toMatchObject({ name: "UnknownOperationError" });

			expect(await subscriptionError.promise).toMatchObject({ name: "UnknownOperationError" });
		} finally {
			connection.close();
		}
	});

	it("propagates explicit server closure and settles closed", async () => {
		type P = {
			requests: { hold: WorkerOperation<void, never> };
			subscriptions: Record<never, never>;
		};

		const started = Promise.withResolvers<void>();
		const connection = open<P>({
			requests: {
				hold: (_input, { signal }) =>
					new Promise((_resolve, reject) => {
						started.resolve();
						signal.addEventListener("abort", () => reject(signal.reason), { once: true });
					}),
			},
			subscriptions: {},
		});
		const request = connection.client.request("hold");

		await started.promise;

		connection.server.close("worker stopped");

		await expect(request).rejects.toMatchObject({
			name: "ConnectionClosedError",
			message: "worker stopped",
		});

		await expect(connection.client.closed).resolves.toBeUndefined();

		connection.close();
	});

	it("propagates client closure and cleans up server operations", async () => {
		type P = {
			requests: Record<never, never>;
			subscriptions: { hold: WorkerOperation<void, void> };
		};

		const started = Promise.withResolvers<void>();
		const cleaned = Promise.withResolvers<boolean>();
		const connection = open<P>({
			requests: {},
			subscriptions: {
				hold: (_input, { signal }) => {
					started.resolve();
					return () => cleaned.resolve(signal.aborted);
				},
			},
		});

		connection.client.subscribe("hold", noop);

		await started.promise;

		connection.client.close();

		await expect(connection.server.closed).resolves.toBeUndefined();

		expect(await cleaned.promise).toBe(true);

		connection.close();
	});

	it("ignores malformed frames without consuming a pending request", async () => {
		const { port1, port2 } = new MessageChannel();

		type P = { requests: { manual: WorkerOperation<void, string> }; subscriptions: Record<never, never> };

		const client = connect<P>(port1);
		const opened = new Promise<unknown[]>((resolve) =>
			port2.addEventListener("message", ({ data }) => resolve(data as unknown[]), { once: true }),
		);

		port2.start();

		const request = client.request("manual");
		const message = await opened;

		port2.postMessage([message[0], "settle", message[2], "malformed"]);
		port2.postMessage([message[0], "resolve", message[2], "valid"]);

		try {
			expect(await request).toBe("valid");
		} finally {
			client.close();
			port1.close();
			port2.close();
		}
	});
});

const noop = (): void => {};
