/// <reference lib="esnext.disposable" />

import { describe, expect, it, vi } from "vitest";
import type { Handlers, Protocol, RequestContext } from "../src/client-messaging.js";
import { connect, RemoteError, serve, transfer } from "../src/client-messaging.js";
import { protocol } from "../src/lib/.internals.js";
import type { ProtocolDefinition } from "../src/lib/.types.js";

const open = <P extends Protocol & ProtocolDefinition<P>>(handlers: Handlers<P>) => {
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
				add(input: { a: number; b: number }): number;
				fail(): never;
			};
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

	it("serves request-only handlers", async () => {
		type P = { requests: { status(): string } };

		const connection = open<P>({ requests: { status: () => "ready" } });

		try {
			expect(await connection.client.request("status")).toBe("ready");
		} finally {
			connection.close();
		}
	});

	it("transfers values in both directions", async () => {
		type P = {
			requests: { echo(buffer: ArrayBuffer): ArrayBuffer };
		};

		const connection = open<P>({
			requests: { echo: (buffer) => transfer(buffer, [buffer]) },
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
			requests: { uncloneable(): unknown };
		};

		const connection = open<P>({
			requests: { uncloneable: () => () => undefined },
		});

		try {
			await expect(connection.client.request("uncloneable")).rejects.toMatchObject({ name: "DataCloneError" });
		} finally {
			connection.close();
		}
	});

	it("propagates AbortSignal cancellation to a running handler", async () => {
		type P = {
			requests: { hold(): never };
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
				ignored(value: number): number;
				late(): void;
				observed(): boolean;
			};
		};

		const NativeAbortController = AbortController;

		let constructions = 0;
		let lateContext: RequestContext | undefined;

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
		});

		try {
			if (navigator.locks) {
				await vi.waitFor(() => expect(constructions).toBe(1));
			}

			const baseline = constructions;

			expect(await connection.client.request("ignored", 42)).toBe(42);
			expect(constructions).toBe(baseline);
			expect(await connection.client.request("observed")).toBe(false);
			expect(constructions).toBe(baseline + 1);

			await connection.client.request("late");

			expect(constructions).toBe(baseline + 1);

			const lateSignal = lateContext!.signal;

			expect(lateSignal.aborted).toBe(true);
			expect(lateContext!.signal).toBe(lateSignal);
			expect(constructions).toBe(baseline + 2);
		} finally {
			connection.close();

			vi.unstubAllGlobals();
		}
	});
});

describe("subscriptions", () => {
	it("serves subscription-only handlers", async () => {
		type P = { subscriptions: { ready(): string } };

		const completed = Promise.withResolvers<void>();
		const connection = open<P>({
			subscriptions: {
				ready: (_input, { emit, complete }) => {
					emit("ready");
					complete();
				},
			},
		});
		const values: string[] = [];

		connection.client.subscribe("ready", (value) => values.push(value), { onComplete: completed.resolve });

		try {
			await completed.promise;

			expect(values).toEqual(["ready"]);
		} finally {
			connection.close();
		}
	});

	it("delivers ordered values, completes, and runs cleanup once", async () => {
		type P = {
			subscriptions: { numbers(input: { start: number }): number };
		};

		const cleanup = vi.fn();
		const completed = Promise.withResolvers<void>();
		const connection = open<P>({
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
			subscriptions: { hold(): void };
		};

		const cleaned = Promise.withResolvers<boolean>();
		const connection = open<P>({
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
			subscriptions: { chunk(): ArrayBuffer };
		};

		const completed = Promise.withResolvers<void>();
		const connection = open<P>({
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
			subscriptions: { uncloneable(): unknown };
		};

		const cleanup = vi.fn();
		const failed = Promise.withResolvers<Error>();
		const connection = open<P>({
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

	it("reports unhandled subscription failures", async () => {
		type P = {
			subscriptions: { fail(): void };
		};

		const failure = new Error("expected failure");
		const reported = Promise.withResolvers<unknown>();

		vi.stubGlobal("reportError", reported.resolve);

		const connection = open<P>({
			subscriptions: {
				fail: (_input, { error }) => error(failure),
			},
		});

		try {
			connection.client.subscribe("fail", noop);

			const error = await reported.promise;

			expect(error).toBeInstanceOf(RemoteError);
			expect(error).toMatchObject({ name: "Error", message: failure.message });
		} finally {
			vi.unstubAllGlobals();

			connection.close();
		}
	});

	it("does not open operations for signals that are already aborted", async () => {
		type P = {
			requests: { request(): void };
			subscriptions: { subscription(): void };
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
			requests: { missing(): never };
			subscriptions: { constructor(): never };
		};

		const connection = open<P>({
			requests: {} as Handlers<P>["requests"],
			subscriptions: {} as Handlers<P>["subscriptions"],
		});
		const subscriptionError = Promise.withResolvers<Error>();

		try {
			connection.client.subscribe("constructor", noop, { onError: subscriptionError.resolve });

			await expect(connection.client.request("missing")).rejects.toBeInstanceOf(RemoteError);
			await expect(connection.client.request("missing")).rejects.toMatchObject({ name: "UnknownOperationError" });

			expect(await subscriptionError.promise).toMatchObject({ name: "UnknownOperationError" });
		} finally {
			connection.close();
		}
	});

	it("reports remote unknown operations for omitted handler sections", async () => {
		type P = {
			requests: { missingRequest(): never };
			subscriptions: { missingSubscription(): never };
		};
		const { port1, port2 } = new MessageChannel();
		const client = connect<P>(port1);
		const server = serve<Record<never, never>>(port2, {});
		const subscriptionError = Promise.withResolvers<Error>();
		const request = client.request("missingRequest");

		client.subscribe("missingSubscription", noop, { onError: subscriptionError.resolve });

		try {
			await expect(request).rejects.toBeInstanceOf(RemoteError);
			await expect(request).rejects.toMatchObject({ name: "UnknownOperationError" });

			expect(await subscriptionError.promise).toMatchObject({ name: "UnknownOperationError" });
		} finally {
			client.close();
			server.close();

			port1.close();
			port2.close();
		}
	});

	it("propagates explicit server closure and settles closed", async () => {
		type P = {
			requests: { hold(): never };
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

	it("rejects pending requests when the client closes", async () => {
		type P = {
			requests: { hold(): never };
		};

		const started = Promise.withResolvers<void>();
		const connection = open<P>({
			requests: {
				hold: (_input, { signal }) =>
					new Promise<never>((_resolve, reject) => {
						started.resolve();
						signal.addEventListener("abort", () => reject(signal.reason), { once: true });
					}),
			},
		});
		const request = connection.client.request("hold");

		await started.promise;

		connection.client.close("window stopped");

		await expect(request).rejects.toMatchObject({
			name: "ConnectionClosedError",
			message: "window stopped",
		});
		await expect(connection.server.closed).resolves.toBeUndefined();

		connection.close();
	});

	it("propagates client closure and cleans up server operations", async () => {
		type P = {
			subscriptions: { hold(): void };
		};

		const started = Promise.withResolvers<void>();
		const cleaned = Promise.withResolvers<boolean>();
		const connection = open<P>({
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

		type P = { requests: { manual(): string } };

		const client = connect<P>(port1);
		const opened = new Promise<unknown[]>((resolve) => {
			const receive = ({ data }: MessageEvent): void => {
				if (Array.isArray(data) && data[1] === "request") {
					port2.removeEventListener("message", receive);
					resolve(data as unknown[]);
				}
			};

			port2.addEventListener("message", receive);
		});

		port2.start();

		const request = client.request("manual");
		const message = await opened;

		port2.postMessage([message[0], "settle", message[2], "malformed"]);
		port2.postMessage([message[0], "reject", message[2], { name: "Error", message: "malformed", stack: 42 }]);
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

describe("liveness", () => {
	const isLease = (lock: LockInfo | undefined): boolean => !!lock?.name?.startsWith(`${protocol}#`);
	const hasWebLocks = typeof navigator.locks?.query === "function";

	it("announces the queued lease before the first operation", async () => {
		const messages: unknown[][] = [];

		vi.stubGlobal("navigator", {
			locks: { request: () => Promise.resolve() },
		});

		try {
			const client = connect<{ requests: { ping(): string } }>({
				addEventListener: noop,
				removeEventListener: noop,
				postMessage: (message: unknown) => messages.push(message as unknown[]),
			});
			const request = client.request("ping");

			expect(messages.map((message) => message[1])).toEqual(["lease", "request"]);

			client.close();

			await expect(request).rejects.toMatchObject({ name: "ConnectionClosedError" });
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("works without Web Locks", async () => {
		vi.stubGlobal("navigator", {});

		try {
			const connection = open<{ requests: { ping(): string } }>({ requests: { ping: () => "pong" } });

			try {
				expect(await connection.client.request("ping")).toBe("pong");
			} finally {
				connection.close();
			}
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it.runIf(hasWebLocks)("finishes the server when an abandoned liveness lease is released", async () => {
		type P = { requests: { ping(): string } };

		const { port1, port2 } = new MessageChannel();
		const client = connect<P>(port1);
		const server = serve<P>(port2, { requests: { ping: () => "pong" } });

		expect(await client.request("ping")).toBe("pong");

		const name = await vi.waitFor(async () => {
			const { held } = await navigator.locks.query();
			const lease = held?.find(isLease);

			expect(lease?.name).toBeDefined();

			return lease?.name as string;
		});

		await navigator.locks.request(name, { steal: true }, noop);

		await expect(server.closed).resolves.toBeUndefined();

		client.close();

		port1.close();
		port2.close();
	});

	it.runIf(hasWebLocks)("releases the liveness lease when the client closes", async () => {
		type P = { requests: { ping(): string } };

		const { port1, port2 } = new MessageChannel();
		const client = connect<P>(port1);
		const server = serve<P>(port2, { requests: { ping: () => "pong" } });

		expect(await client.request("ping")).toBe("pong");

		await vi.waitFor(async () => {
			const { held } = await navigator.locks.query();

			expect(held?.some(isLease)).toBe(true);
		});

		client.close();

		await expect(server.closed).resolves.toBeUndefined();

		await vi.waitFor(async () => {
			const { held, pending } = await navigator.locks.query();

			expect(held?.some(isLease) ?? false).toBe(false);
			expect(pending?.some(isLease) ?? false).toBe(false);
		});

		port1.close();
		port2.close();
	});

	it.runIf(hasWebLocks)("closes the client and releases the lease on pagehide", async () => {
		type P = { requests: { ping(): string } };

		const listeners = new Set<() => void>();

		vi.stubGlobal("onpagehide", null);
		vi.stubGlobal("addEventListener", (type: string, listener: () => void) => {
			if (type === "pagehide") {
				listeners.add(listener);
			}
		});
		vi.stubGlobal("removeEventListener", (type: string, listener: () => void) => {
			if (type === "pagehide") {
				listeners.delete(listener);
			}
		});

		try {
			const { port1, port2 } = new MessageChannel();
			const client = connect<P>(port1);
			const server = serve<P>(port2, { requests: { ping: () => "pong" } });

			expect(await client.request("ping")).toBe("pong");

			await vi.waitFor(async () => {
				const { held } = await navigator.locks.query();

				expect(held?.some(isLease)).toBe(true);
			});

			expect(listeners.size).toBe(1);

			listeners.forEach((listener) => {
				listener();
			});

			await expect(client.closed).resolves.toBeUndefined();
			await expect(server.closed).resolves.toBeUndefined();
			await expect(client.request("ping")).rejects.toMatchObject({ name: "ConnectionClosedError" });

			expect(listeners.size).toBe(0);

			await vi.waitFor(async () => {
				const { held, pending } = await navigator.locks.query();

				expect(held?.some(isLease) ?? false).toBe(false);
				expect(pending?.some(isLease) ?? false).toBe(false);
			});

			port1.close();
			port2.close();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

const noop = (): void => {};
