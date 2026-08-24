/// <reference lib="dom" />

import { DB } from "@serve-tools/client-db";
import { Signal } from "@serve-tools/signal";
import { expect, test } from "vitest";

import { SignalDB } from "../../src/signal-db.js";

interface Note {
	readonly id: string;
	readonly text: string;
}

interface Schema {
	notes: SignalDB.Store<Note, string>;
}

const ready = <Value>(value: Value) => ({ status: "ready", value });

test("refreshes real IndexedDB queries after committed writes and transactions", async () => {
	const name = `signal-db-test-${crypto.randomUUID()}`;
	const db = await SignalDB.open<Schema>(name, {
		version: 1,
		upgrade(database) {
			database.createObjectStore("notes", { keyPath: "id" });
		},
	});
	const selectedKey = new Signal.State("one");
	const selected = db.watch("notes", selectedKey);
	const notes = db.watchAll("notes");
	const noteKeys = db.watchAllKeys("notes");
	const noteCount = db.watchCount("notes");
	const one = { id: "one", text: "First" };
	const two = { id: "two", text: "Second" };

	try {
		expect(selected.get()).toEqual({ status: "pending" });
		expect(notes.get()).toEqual({ status: "pending" });

		await expect
			.poll(() => [selected.get(), notes.get(), noteKeys.get(), noteCount.get()])
			.toEqual([ready(undefined), ready([]), ready([]), ready(0)]);

		await db.add("notes", one);
		await expect
			.poll(() => [selected.get(), notes.get(), noteKeys.get(), noteCount.get()])
			.toEqual([ready(one), ready([one]), ready([one.id]), ready(1)]);

		await db.transaction("notes", { mode: "readwrite" }, (transaction) =>
			transaction.objectStore("notes").put(two),
		);
		await expect.poll(() => notes.get()).toEqual(ready([one, two]));

		selectedKey.set(two.id);

		await expect.poll(() => selected.get()).toEqual(ready(two));

		expect(Signal.subtle.hasSinks(selectedKey)).toBe(true);

		selected.dispose();

		expect(Signal.subtle.hasSinks(selectedKey)).toBe(false);
	} finally {
		selected.dispose();
		notes.dispose();
		noteKeys.dispose();
		noteCount.dispose();

		db.close();

		await DB.delete(name);
	}
});
