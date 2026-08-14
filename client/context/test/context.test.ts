import { describe, expect, it, vi } from "vitest";
import { ContextConsumer, ContextProvider, ContextRequestEvent, createContext } from "../src/client-context.js";

const appendFixture = (...elements: Element[]): (() => void) => {
	document.body.append(...elements);

	return () => {
		for (const element of elements) {
			element.remove();
		}
	};
};

describe("context protocol", () => {
	it("rejects NaN context keys", () => {
		const context = createContext<number>(Number.NaN);
		const host = document.createElement("div");

		expect(() => new ContextProvider(host, { context, initialValue: 1 })).toThrow(
			new TypeError("A context key cannot be NaN."),
		);
	});

	it("delivers a one-time value synchronously without retaining the callback", () => {
		const context = createContext<number>(Symbol("one-time"));
		const providerHost = document.createElement("section");
		const consumerHost = document.createElement("span");
		const provider = new ContextProvider(providerHost, { context, initialValue: 1 });
		const values: number[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context,
			callback(value) {
				expect(this).toBe(consumerHost);
				values.push(value);
			},
		});

		providerHost.append(consumerHost);
		const cleanup = appendFixture(providerHost);
		provider.connect();
		consumer.connect();

		try {
			expect(values).toEqual([1]);

			provider.setValue(2);

			expect(values).toEqual([1]);
		} finally {
			consumer.disconnect();
			provider.disconnect();
			cleanup();
		}
	});

	it("retains a subscribing miss until a provider connects", () => {
		const context = createContext<number>(Symbol("late"));
		const providerHost = document.createElement("section");
		const consumerHost = document.createElement("span");
		const provider = new ContextProvider(providerHost, { context, initialValue: 1 });
		const values: number[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context,
			subscribe: true,
			callback: (value) => values.push(value),
		});

		providerHost.append(consumerHost);
		const cleanup = appendFixture(providerHost);
		consumer.connect();

		try {
			expect(values).toEqual([]);

			provider.connect();

			expect(values).toEqual([1]);

			provider.setValue(2);

			expect(values).toEqual([1, 2]);
		} finally {
			consumer.disconnect();
			provider.disconnect();
			cleanup();
		}
	});

	it("cancels an unanswered subscription deterministically", () => {
		const context = createContext<number>(Symbol("cancel"));
		const providerHost = document.createElement("section");
		const consumerHost = document.createElement("span");
		const callback = vi.fn();
		const consumer = new ContextConsumer(consumerHost, { context, subscribe: true, callback });
		const provider = new ContextProvider(providerHost, { context, initialValue: 1 });

		providerHost.append(consumerHost);
		const cleanup = appendFixture(providerHost);
		consumer.connect();
		consumer.disconnect();
		provider.connect();

		try {
			expect(callback).not.toHaveBeenCalled();
		} finally {
			provider.disconnect();
			cleanup();
		}
	});

	it("moves a subscription to a newly active nearer provider and falls back when it disconnects", () => {
		const context = createContext<string>(Symbol("takeover"));
		const outerHost = document.createElement("section");
		const innerHost = document.createElement("div");
		const consumerHost = document.createElement("span");
		const outer = new ContextProvider(outerHost, { context, initialValue: "outer" });
		const inner = new ContextProvider(innerHost, { context, initialValue: "inner" });
		const values: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context,
			subscribe: true,
			callback: (value) => values.push(value),
		});

		innerHost.append(consumerHost);
		outerHost.append(innerHost);
		const cleanup = appendFixture(outerHost);
		outer.connect();
		consumer.connect();

		try {
			expect(values).toEqual(["outer"]);

			inner.connect();
			outer.setValue("ignored");
			inner.setValue("nearer");

			expect(values).toEqual(["outer", "inner", "nearer"]);

			inner.disconnect();
			outer.setValue("fallback");

			expect(values).toEqual(["outer", "inner", "nearer", "ignored", "fallback"]);
		} finally {
			consumer.disconnect();
			inner.disconnect();
			outer.disconnect();
			cleanup();
		}
	});

	it("re-evaluates an explicit state-preserving move", () => {
		const context = createContext<string>(Symbol("move"));
		const firstHost = document.createElement("section");
		const secondHost = document.createElement("section");
		const consumerHost = document.createElement("span");
		const first = new ContextProvider(firstHost, { context, initialValue: "first" });
		const second = new ContextProvider(secondHost, { context, initialValue: "second" });
		const values: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context,
			subscribe: true,
			callback: (value) => values.push(value),
		});

		firstHost.append(consumerHost);
		const cleanup = appendFixture(firstHost, secondHost);
		first.connect();
		second.connect();
		consumer.connect();

		try {
			secondHost.append(consumerHost);
			consumer.refresh();

			expect(values).toEqual(["first", "second"]);
		} finally {
			consumer.disconnect();
			first.disconnect();
			second.disconnect();
			cleanup();
		}
	});

	it("deduplicates the same subscription while keeping callback identity per consumer", () => {
		const context = createContext<number>(Symbol("identity"));
		const providerHost = document.createElement("section");
		const firstConsumer = document.createElement("span");
		const secondConsumer = document.createElement("span");
		const provider = new ContextProvider(providerHost, { context, initialValue: 1 });
		const deliveries: Element[] = [];
		const unsubscribes: Array<(() => void) | undefined> = [];
		function callback(this: Element, _value: number, unsubscribe?: () => void): void {
			deliveries.push(this);
			unsubscribes.push(unsubscribe);
		}

		providerHost.append(firstConsumer, secondConsumer);
		const cleanup = appendFixture(providerHost);
		provider.connect();

		try {
			firstConsumer.dispatchEvent(new ContextRequestEvent(context, firstConsumer, callback, true));
			firstConsumer.dispatchEvent(new ContextRequestEvent(context, firstConsumer, callback, true));
			secondConsumer.dispatchEvent(new ContextRequestEvent(context, secondConsumer, callback, true));

			expect(deliveries).toEqual([firstConsumer, secondConsumer]);
			expect(unsubscribes[0]).toBeTypeOf("function");
			expect(unsubscribes[1]).toBeTypeOf("function");
			expect(unsubscribes[0]).not.toBe(unsubscribes[1]);

			provider.setValue(2);

			expect(deliveries).toEqual([firstConsumer, secondConsumer, firstConsumer, secondConsumer]);
			expect(unsubscribes[2]).toBe(unsubscribes[0]);
			expect(unsubscribes[3]).toBe(unsubscribes[1]);
		} finally {
			unsubscribes[0]?.();
			unsubscribes[1]?.();
			provider.disconnect();
			cleanup();
		}
	});

	it("rolls back a subscription whose initial callback fails", () => {
		const context = createContext<number>(Symbol("initial-failure"));
		const providerHost = document.createElement("section");
		const consumerHost = document.createElement("span");
		const provider = new ContextProvider(providerHost, { context, initialValue: 1 });
		const callback = vi.fn(() => {
			throw new Error("initial failure");
		});
		const report = vi.spyOn(globalThis, "reportError").mockImplementation(() => undefined);

		providerHost.append(consumerHost);
		const cleanup = appendFixture(providerHost);
		provider.connect();

		try {
			consumerHost.dispatchEvent(new ContextRequestEvent(context, consumerHost, callback, true));
			provider.setValue(2);

			expect(callback).toHaveBeenCalledOnce();
			expect(report).toHaveBeenCalledOnce();
		} finally {
			report.mockRestore();
			provider.disconnect();
			cleanup();
		}
	});

	it("isolates later callback failures from other subscribers", () => {
		const context = createContext<number>(Symbol("update-failure"));
		const providerHost = document.createElement("section");
		const failingHost = document.createElement("span");
		const succeedingHost = document.createElement("span");
		const provider = new ContextProvider(providerHost, { context, initialValue: 1 });
		const values: number[] = [];
		let shouldFail = false;
		const report = vi.spyOn(globalThis, "reportError").mockImplementation(() => undefined);

		providerHost.append(failingHost, succeedingHost);
		const cleanup = appendFixture(providerHost);
		provider.connect();
		failingHost.dispatchEvent(
			new ContextRequestEvent(
				context,
				failingHost,
				() => {
					if (shouldFail) {
						throw new Error("update failure");
					}
				},
				true,
			),
		);
		succeedingHost.dispatchEvent(
			new ContextRequestEvent(context, succeedingHost, (value) => values.push(value), true),
		);

		try {
			shouldFail = true;
			provider.setValue(2);

			expect(values).toEqual([1, 2]);
			expect(report).toHaveBeenCalledOnce();
		} finally {
			report.mockRestore();
			provider.disconnect();
			cleanup();
		}
	});

	it("interoperates with a structurally defined request event and ignores malformed requests", () => {
		const context = createContext<number>(Symbol("structural"));
		const providerHost = document.createElement("section");
		const consumerHost = document.createElement("span");
		const provider = new ContextProvider(providerHost, { context, initialValue: 1 });
		const callback = vi.fn();

		class IndependentRequestEvent extends Event {
			readonly context = context;
			readonly contextTarget = consumerHost;
			readonly callback = callback;

			constructor(options: EventInit) {
				super("context-request", options);
			}
		}

		providerHost.append(consumerHost);
		const cleanup = appendFixture(providerHost);
		provider.connect();

		try {
			consumerHost.dispatchEvent(new IndependentRequestEvent({ bubbles: true, composed: true }));
			consumerHost.dispatchEvent(new IndependentRequestEvent({ bubbles: false, composed: true }));
			consumerHost.dispatchEvent(new IndependentRequestEvent({ bubbles: true, composed: false }));
			consumerHost.dispatchEvent(
				new IndependentRequestEvent({ bubbles: true, composed: true, cancelable: true }),
			);

			expect(callback).toHaveBeenCalledOnce();
			expect(callback).toHaveBeenCalledWith(1);
		} finally {
			provider.disconnect();
			cleanup();
		}
	});
});
