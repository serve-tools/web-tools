import type { DB } from "@serve-tools/client-db";
import { Signal } from "@serve-tools/signal";
import { expect, test, vi } from "vitest";
import { SignalDB } from "../src/signal-db.js";

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
