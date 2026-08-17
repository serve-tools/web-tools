import type { DB } from "@serve-tools/client-db";
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
