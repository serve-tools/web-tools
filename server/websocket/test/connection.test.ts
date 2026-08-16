import type { ClientMessage, ServerMessage } from "@serve-tools/realtime-protocol";
import { deserialize, protocol, serialize } from "@serve-tools/realtime-protocol";
import { describe, expect, it, vi } from "vitest";

import { createConnection } from "../src/lib/connection.js";
import type { SubscriptionContext } from "../src/lib/types.js";

interface TestProtocol {
	requests: {
		add(input: { a: number; b: number }): number;
		hold(): never;
		uncloneable(): unknown;
	};
	subscriptions: {
		numbers(start: number): number;
		lateCleanup(): number;
	};
}

const tick = async (): Promise<void> => {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
};

const setup = (overrides: Record<string, unknown> = {}) => {
	const sent: ServerMessage[] = [];
	const closes: Array<[number, string]> = [];
	const reports: unknown[] = [];
	const add = vi.fn(({ a, b }: { a: number; b: number }) => a + b);
	const handlers = {
		requests: {
			add,
			hold: (_input: undefined, { signal }: { signal: AbortSignal }) =>
				new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
			uncloneable: () => () => undefined,
		},
		subscriptions: {
			numbers: vi.fn(),
			lateCleanup: vi.fn(),
		},
		...overrides,
	};
	const connection = createConnection<TestProtocol, { user: string }>(
		handlers as never,
		{
			send(payload) {
				sent.push(deserialize(payload) as ServerMessage);
			},
			close(code, reason) {
				closes.push([code, reason]);
			},
		},
		{ user: "ada" },
		{ reportError: (error) => reports.push(error) },
	);
	const receive = (message: ClientMessage): void => connection.receive(serialize(message));

	return { add, closes, connection, handlers, receive, reports, sent };
};

describe("createConnection", () => {
	it("dispatches concurrent requests with typed connection state", async () => {
		const { add, connection, receive, sent } = setup();

		receive([protocol, "request", 1, "add", { a: 1, b: 2 }]);
		receive([protocol, "request", 2, "add", { a: 10, b: 5 }]);

		await tick();

		expect(add).toHaveBeenCalledTimes(2);
		expect(connection.context).toEqual({ user: "ada" });
		expect(sent).toEqual([
			[protocol, "resolve", 1, 3],
			[protocol, "resolve", 2, 15],
		]);
	});

	it("emits, completes, and cleans up subscriptions exactly once", async () => {
		const cleanup = vi.fn();
		let subscription: SubscriptionContext<number, { user: string }> | undefined;
		const { receive, sent } = setup({
			subscriptions: {
				numbers: (_input: number, context: SubscriptionContext<number, { user: string }>) => {
					subscription = context;

					return cleanup;
				},
				lateCleanup: vi.fn(),
			},
		});

		receive([protocol, "subscribe", 1, "numbers", 3]);
		await tick();

		expect(subscription?.connection).toEqual({ user: "ada" });
		subscription?.emit(3);
		subscription?.emit(4);
		subscription?.complete();
		subscription?.complete();
		await tick();

		expect(sent).toEqual([
			[protocol, "event", 1, 3],
			[protocol, "event", 1, 4],
			[protocol, "complete", 1],
		]);
		expect(cleanup).toHaveBeenCalledOnce();
		expect(subscription?.signal.aborted).toBe(true);
	});

	it("aborts cancellation and runs cleanup registered after cancellation", async () => {
		const cleanup = vi.fn();
		let release: ((cleanup: () => void) => void) | undefined;
		let signal: AbortSignal | undefined;
		const pendingCleanup = new Promise<() => void>((resolve) => {
			release = resolve;
		});
		const { receive, sent } = setup({
			subscriptions: {
				numbers: vi.fn(),
				lateCleanup: (_input: undefined, context: SubscriptionContext<number>) => {
					signal = context.signal;

					return pendingCleanup;
				},
			},
		});

		receive([protocol, "subscribe", 1, "lateCleanup", undefined]);
		await tick();
		receive([protocol, "cancel", 1]);

		expect(signal?.aborted).toBe(true);
		expect(sent).toEqual([]);

		release?.(cleanup);
		await tick();

		expect(cleanup).toHaveBeenCalledOnce();
	});

	it("rejects unknown operations and closes on duplicate active IDs", async () => {
		const { closes, connection, receive, sent } = setup();

		receive([protocol, "request", 1, "missing", undefined]);
		receive([protocol, "request", 2, "hold", undefined]);
		await tick();
		receive([protocol, "request", 2, "add", { a: 1, b: 1 }]);

		expect(sent[0]).toEqual([
			protocol,
			"reject",
			1,
			expect.objectContaining({ name: "UnknownOperationError", message: "missing" }),
		]);
		expect(sent.at(-1)).toEqual([
			protocol,
			"close",
			expect.objectContaining({ name: "ProtocolError", message: "Duplicate operation ID" }),
		]);
		expect(closes).toEqual([[1002, "Protocol error"]]);
		await expect(connection.closed).resolves.toBeUndefined();
	});

	it("redacts stacks and converts uncloneable results into rejections", async () => {
		const { receive, sent } = setup();

		receive([protocol, "request", 1, "uncloneable", undefined]);
		await tick();

		expect(sent).toEqual([[protocol, "reject", 1, expect.objectContaining({ name: "DataCloneError" })]]);
		expect((sent[0]![3] as { stack?: string }).stack).toBeUndefined();
	});

	it("normalizes custom error records before exposing them", async () => {
		const sent: ServerMessage[] = [];
		const connection = createConnection<TestProtocol>(
			{
				requests: {
					add: () => {
						throw new Error("private");
					},
					hold: () => new Promise<never>(() => undefined),
					uncloneable: () => undefined,
				},
				subscriptions: { numbers: vi.fn(), lateCleanup: vi.fn() },
			},
			{
				send: (payload) => sent.push(deserialize(payload) as ServerMessage),
				close: vi.fn(),
			},
			undefined,
			{
				formatError: () => ({ name: "PublicError", message: "safe", internal: () => undefined }),
			},
		);

		connection.receive(serialize([protocol, "request", 1, "add", { a: 1, b: 2 }]));
		await tick();

		expect(sent).toEqual([[protocol, "reject", 1, { name: "PublicError", message: "safe" }]]);
	});

	it("enforces message and operation limits", async () => {
		const sent: ServerMessage[] = [];
		const closes: Array<[number, string]> = [];
		const connection = createConnection<TestProtocol>(
			{
				requests: {
					add: ({ a, b }) => a + b,
					hold: () => new Promise<never>(() => undefined),
					uncloneable: () => undefined,
				},
				subscriptions: { numbers: vi.fn(), lateCleanup: vi.fn() },
			},
			{
				send: (payload) => sent.push(deserialize(payload) as ServerMessage),
				close: (code, reason) => closes.push([code, reason]),
			},
			undefined,
			{ maximumMessageLength: 128, maximumOperations: 1 },
		);

		connection.receive(serialize([protocol, "request", 1, "hold", undefined]));
		connection.receive(serialize([protocol, "request", 2, "hold", undefined]));
		await tick();

		expect(sent[0]).toEqual([protocol, "reject", 2, expect.objectContaining({ name: "OperationLimitError" })]);

		connection.receive(new Uint8Array(129));

		expect(closes).toEqual([[1009, "Message too large"]]);
	});

	it("closes instead of growing an observable transport queue past its limit", async () => {
		const closes: Array<[number, string]> = [];
		const connection = createConnection<TestProtocol>(
			{
				requests: {
					add: ({ a, b }) => a + b,
					hold: () => new Promise<never>(() => undefined),
					uncloneable: () => undefined,
				},
				subscriptions: { numbers: vi.fn(), lateCleanup: vi.fn() },
			},
			{
				send: vi.fn(),
				close: (code, reason) => closes.push([code, reason]),
				bufferedAmount: () => 8,
			},
			undefined,
			{ maximumBufferedAmount: 8 },
		);

		connection.receive(serialize([protocol, "request", 1, "add", { a: 1, b: 2 }]));
		await tick();

		expect(closes).toEqual([[1011, "Transport failure"]]);
		await expect(connection.closed).resolves.toBeUndefined();
	});

	it("distinguishes graceful close from an already disconnected transport", async () => {
		const local = setup();

		local.connection.close("finished");

		expect(local.sent).toEqual([
			[protocol, "close", expect.objectContaining({ name: "ConnectionClosedError", message: "finished" })],
		]);
		expect(local.closes).toEqual([[1000, ""]]);

		const remote = setup();

		remote.connection.disconnect("gone");

		expect(remote.sent).toEqual([]);
		expect(remote.closes).toEqual([]);
		await expect(remote.connection.closed).resolves.toBeUndefined();
	});
});
