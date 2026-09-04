import type { DB } from "@serve-tools/client-db";
import { Signal } from "@serve-tools/signal";
import { expect, test, vi } from "vitest";
import { SignalDB } from "../src/signal-db.js";
import { retainQuerySnapshot } from "./signal-db.recipes.js";

test("refreshes watched state after a committed point write", async () => {
	let value = "one";

	const source = {
		get: vi.fn(async () => value),
		put: vi.fn(async (_store: string, next: string) => {
			value = next;

			return "key";
		}),
		close: vi.fn(),
	} as unknown as DB<{ values: DB.Store<string, string> }>;
	const db = new SignalDB(source);
	const query = db.watch("values", "key");

	await vi.waitFor(() => expect(query.get()).toEqual({ status: "ready", value: "one" }));
	await db.put("values", "two", { key: "key" });
	await vi.waitFor(() => expect(query.get()).toEqual({ status: "ready", value: "two" }));

	db.close();

	expect(source.close).toHaveBeenCalledOnce();
});

test("ignores an older read that settles after a newer refresh", async () => {
	const first = Promise.withResolvers<string>();
	const second = Promise.withResolvers<string>();
	const source = {
		get: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
		close: vi.fn(),
	} as unknown as DB<{ values: DB.Store<string, string> }>;
	const db = new SignalDB(source);
	const query = db.watch("values", "key");

	await vi.waitFor(() => expect(source.get).toHaveBeenCalledOnce());

	const refreshed = query.refresh();

	second.resolve("new");

	await refreshed;

	first.resolve("old");

	await first.promise;
	await vi.waitFor(() => expect(query.get()).toEqual({ status: "ready", value: "new" }));

	db.close();
});

test("makes disposal terminal for an in-flight refresh", async () => {
	const initial = Promise.withResolvers<string>();
	const pending = Promise.withResolvers<string>();
	const source = {
		get: vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(pending.promise),
		close: vi.fn(),
	} as unknown as DB<{ values: DB.Store<string, string> }>;
	const db = new SignalDB(source);
	const query = db.watch("values", "key");

	initial.resolve("initial");

	await vi.waitFor(() => expect(query.get()).toEqual({ status: "ready", value: "initial" }));

	const refresh = query.refresh();

	query.dispose();

	await expect(refresh).resolves.toBeUndefined();
	await vi.waitFor(() =>
		expect(query.get()).toMatchObject({ status: "error", error: { name: "InvalidStateError" } }),
	);

	pending.resolve("late");

	await pending.promise;

	expect(query.get()).toMatchObject({ status: "error", error: { name: "InvalidStateError" } });

	await expect(query.refresh()).rejects.toMatchObject({ name: "InvalidStateError" });

	db.close();
});

test("watches reactive key lists and counts with the same invalidation lifecycle", async () => {
	const keys = new Signal.State(1);
	const query = new Signal.State<string | null>(null);
	const source = {
		count: vi.fn(async (_store: string, options?: { query?: string | null }) => (options?.query ? 1 : 2)),
		getAllKeys: vi.fn(async (_store: string, options?: { count?: number }) =>
			["one", "two"].slice(0, options?.count),
		),
		close: vi.fn(),
	} as unknown as DB<{ values: DB.Store<string, string> }>;
	const db = new SignalDB(source);
	const allKeys = db.watchAllKeys("values", { count: keys });
	const count = db.watchCount("values", { query });

	await vi.waitFor(() => {
		expect(allKeys.get()).toEqual({ status: "ready", value: ["one"] });
		expect(count.get()).toEqual({ status: "ready", value: 2 });
	});

	keys.set(2);
	query.set("one");

	await vi.waitFor(() => {
		expect(allKeys.get()).toEqual({ status: "ready", value: ["one", "two"] });
		expect(count.get()).toEqual({ status: "ready", value: 1 });
	});

	db.invalidate("values");
	await vi.waitFor(() => expect(source.count).toHaveBeenCalledTimes(3));

	db.close();
});

test("the retained-query recipe keeps refresh errors separate from its last successful snapshot", async () => {
	const initial = Promise.withResolvers<string>();
	const refreshed = Promise.withResolvers<string>();
	const source = {
		get: vi.fn().mockReturnValueOnce(initial.promise).mockReturnValueOnce(refreshed.promise),
		close: vi.fn(),
	} as unknown as DB<{ values: DB.Store<string, string> }>;
	const db = new SignalDB(source);
	const query = db.watch("values", "one");
	const retained = retainQuerySnapshot(query);

	try {
		expect(retained.state.get()).toEqual({ current: { status: "pending" }, snapshot: undefined });

		initial.resolve("loaded");

		await vi.waitFor(() => expect(retained.state.get().snapshot).toEqual({ status: "ready", value: "loaded" }));

		const snapshot = retained.state.get().snapshot;
		const refreshing = query.refresh();

		await vi.waitFor(() => expect(retained.state.get().current).toEqual({ status: "pending" }));
		expect(retained.state.get().snapshot).toBe(snapshot);

		const error = new Error("Read failed");

		refreshed.reject(error);

		await refreshing;
		await vi.waitFor(() => expect(retained.state.get().current).toEqual({ status: "error", error }));
		expect(retained.state.get().snapshot).toBe(snapshot);
	} finally {
		retained.dispose();
		db.close();
	}
});

test.each([undefined, [], 0, false, null])(
	"the retained-query recipe replaces old data with a successful empty value: %j",
	async (value) => {
		const source = {
			get: vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce(value),
			close: vi.fn(),
		} as unknown as DB<{ values: DB.Store<unknown, string> }>;
		const db = new SignalDB(source);
		const query = db.watch("values", "one");
		const retained = retainQuerySnapshot(query);

		try {
			await vi.waitFor(() => expect(retained.state.get().snapshot).toEqual({ status: "ready", value: "old" }));
			await query.refresh();
			await vi.waitFor(() =>
				expect(retained.state.get()).toEqual({
					current: { status: "ready", value },
					snapshot: { status: "ready", value },
				}),
			);

			expect(retained.state.get().snapshot).not.toBeUndefined();
		} finally {
			retained.dispose();
			db.close();
		}
	},
);

test("the retained-query recipe exposes an initial error without inventing a snapshot", async () => {
	const error = new Error("Initial read failed");
	const source = {
		get: vi.fn().mockRejectedValue(error),
		close: vi.fn(),
	} as unknown as DB<{ values: DB.Store<string, string> }>;
	const db = new SignalDB(source);
	const retained = retainQuerySnapshot(db.watch("values", "one"));

	try {
		await vi.waitFor(() =>
			expect(retained.state.get()).toEqual({ current: { status: "error", error }, snapshot: undefined }),
		);
	} finally {
		retained.dispose();
		db.close();
	}
});

test("disposing the retained-query recipe freezes its view and releases the owned query", async () => {
	const late = Promise.withResolvers<string>();
	const source = {
		get: vi.fn().mockResolvedValueOnce("loaded").mockReturnValueOnce(late.promise),
		close: vi.fn(),
	} as unknown as DB<{ values: DB.Store<string, string> }>;
	const db = new SignalDB(source);
	const query = db.watch("values", "one");
	const retained = retainQuerySnapshot(query);

	try {
		await vi.waitFor(() => expect(retained.state.get().snapshot).toEqual({ status: "ready", value: "loaded" }));

		const refreshing = query.refresh();

		await vi.waitFor(() => expect(retained.state.get().current).toEqual({ status: "pending" }));

		const retired = retained.state.get();

		retained.dispose();
		late.resolve("too late");

		await refreshing;
		await late.promise;

		expect(retained.state.get()).toBe(retired);
		expect(Signal.subtle.hasSinks(query)).toBe(false);
		expect(source.close).not.toHaveBeenCalled();
		await expect(query.refresh()).rejects.toMatchObject({ name: "InvalidStateError" });
	} finally {
		retained.dispose();
		db.close();
	}
});

test("replacing a fixed-query owner does not inherit the previous record snapshot", async () => {
	const nextRecord = Promise.withResolvers<string>();
	const source = {
		get: vi.fn().mockResolvedValueOnce("First record").mockReturnValueOnce(nextRecord.promise),
		close: vi.fn(),
	} as unknown as DB<{ values: DB.Store<string, string> }>;
	const db = new SignalDB(source);
	const first = retainQuerySnapshot(db.watch("values", "first"));

	try {
		await vi.waitFor(() => expect(first.state.get().snapshot).toEqual({ status: "ready", value: "First record" }));
		first.dispose();

		const second = retainQuerySnapshot(db.watch("values", "second"));

		try {
			expect(second.state.get()).toEqual({ current: { status: "pending" }, snapshot: undefined });

			nextRecord.resolve("Second record");

			await vi.waitFor(() =>
				expect(second.state.get().snapshot).toEqual({ status: "ready", value: "Second record" }),
			);
		} finally {
			second.dispose();
		}
	} finally {
		first.dispose();
		db.close();
	}
});
