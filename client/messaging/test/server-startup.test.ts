import { describe, expect, it, vi } from "vitest";
import type { MessageEndpoint, RequestContext } from "../src/client-messaging.js";
import { serve } from "../src/client-messaging.js";
import { protocol } from "../src/lib/.internals.js";

const startupEndpoint = (start: (dispatch: (data: unknown) => void) => void) => {
	type MessageListener = Parameters<MessageEndpoint["addEventListener"]>[1];

	const listeners = new Set<MessageListener>();
	let receive: MessageListener = () => {};
	const dispatch = (data: unknown): void => receive({ data });
	const endpoint = {
		addEventListener: (_type: "message", listener: MessageListener) => {
			listeners.add(listener);
			receive = listener;
		},
		removeEventListener: vi.fn((_type: "message", listener: MessageListener) => listeners.delete(listener)),
		postMessage: vi.fn(),
		start: () => start(dispatch),
		close: vi.fn(),
	};

	return { endpoint, listeners, dispatch };
};

describe("server startup", () => {
	it("removes its listener and preserves the original startup error without closing the transport", () => {
		const startupError = new Error("Endpoint startup failed");
		const { endpoint, listeners } = startupEndpoint(() => {
			throw startupError;
		});
		const start = vi.fn(() => serve<Record<never, never>>(endpoint, {}));

		expect(start).toThrow(startupError);
		expect(start.mock.results[0]!.value).toBe(startupError);
		expect(listeners.size).toBe(0);
		expect(endpoint.removeEventListener).toHaveBeenCalledOnce();
		expect(endpoint.postMessage).not.toHaveBeenCalled();
		expect(endpoint.close).not.toHaveBeenCalled();
	});

	it("ignores a captured listener after startup fails", async () => {
		type P = {
			requests: { ping(): void };
			subscriptions: { updates(): void };
		};

		const startupError = new Error("Endpoint startup failed");
		const { endpoint, dispatch } = startupEndpoint(() => {
			throw startupError;
		});
		const ping = vi.fn();
		const updates = vi.fn();

		expect(() => serve<P>(endpoint, { requests: { ping }, subscriptions: { updates } })).toThrow(startupError);

		dispatch([protocol, "hello"]);
		dispatch([protocol, "request", 1, "ping", undefined]);
		dispatch([protocol, "subscription", 2, "updates", undefined]);
		dispatch([protocol, "close", { name: "Error", message: "Late close" }]);
		dispatch("malformed late message");

		await Promise.resolve();
		await Promise.resolve();

		expect(ping).not.toHaveBeenCalled();
		expect(updates).not.toHaveBeenCalled();
		expect(endpoint.postMessage).not.toHaveBeenCalled();
	});

	it.each(["resolve", "reject"] as const)(
		"aborts operations accepted during startup, ignores late %s, and runs delayed cleanup once",
		async (outcome) => {
			type P = {
				requests: { pending(): string };
				subscriptions: { updates(): string };
			};

			const startupError = new Error("Endpoint startup failed");
			const { endpoint, listeners, dispatch } = startupEndpoint((receive) => {
				receive([protocol, "hello"]);
				receive([protocol, "request", 1, "pending", undefined]);
				receive([protocol, "subscription", 2, "updates", undefined]);
				throw startupError;
			});
			const request = Promise.withResolvers<string>();
			const subscription = Promise.withResolvers<() => void>();
			const contexts: RequestContext[] = [];
			const abortedAtEntry: boolean[] = [];
			const cleanup = vi.fn();

			expect(() =>
				serve<P>(endpoint, {
					requests: {
						pending: (_input, context) => {
							contexts.push(context);
							abortedAtEntry.push(context.signal.aborted);
							return request.promise;
						},
					},
					subscriptions: {
						updates: (_input, context) => {
							contexts.push(context);
							abortedAtEntry.push(context.signal.aborted);
							context.emit("late event");
							context.complete();
							context.error(new Error("Late subscription failure"));
							return subscription.promise;
						},
					},
				}),
			).toThrow(startupError);

			await Promise.resolve();

			expect(abortedAtEntry).toEqual([true, true]);
			expect(listeners.size).toBe(0);
			expect(contexts).toHaveLength(2);
			expect(contexts.map(({ signal }) => signal.aborted)).toEqual([true, true]);
			expect(cleanup).not.toHaveBeenCalled();

			if (outcome === "resolve") {
				request.resolve("late result");
			} else {
				request.reject(new Error("Late request failure"));
			}

			subscription.resolve(cleanup);

			await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce());

			dispatch([protocol, "cancel", 2]);
			dispatch([protocol, "close", { name: "Error", message: "Late close" }]);

			await Promise.resolve();

			expect(cleanup).toHaveBeenCalledOnce();
			expect(endpoint.postMessage.mock.calls).toEqual([[[protocol, "welcome"]]]);
		},
	);

	it("cancels a lease watch opened synchronously during startup", async () => {
		const startupError = new Error("Endpoint startup failed");
		const watch = vi.fn(
			(_name: string, { signal }: LockOptions) =>
				new Promise<void>((_resolve, reject) => {
					signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
				}),
		);
		const { endpoint, listeners, dispatch } = startupEndpoint((receive) => {
			receive([protocol, "hello"]);
			receive([protocol, "lease", "startup-lease"]);
			throw startupError;
		});

		vi.stubGlobal("navigator", { locks: { request: watch } });

		try {
			expect(() => serve<Record<never, never>>(endpoint, {})).toThrow(startupError);
			expect(listeners.size).toBe(0);
			expect(watch).toHaveBeenCalledOnce();
			expect(watch.mock.calls[0]![1].signal?.aborted).toBe(true);

			await expect(watch.mock.results[0]!.value).rejects.toMatchObject({ name: "AbortError" });

			dispatch([protocol, "lease", "late-lease"]);

			expect(watch).toHaveBeenCalledOnce();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
