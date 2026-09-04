/// <reference lib="dom" />

import { DB } from "@serve-tools/client-db";
import { Signal } from "@serve-tools/signal";
import { expect, test, vi } from "vitest";

import { SignalDB } from "../../src/signal-db.js";
import { mountDraftEditor } from "../signal-db.recipes.js";

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

test("the editor recipe retains a draft across refresh, errors, and successful peer edits", async () => {
	const name = `signal-db-draft-${crypto.randomUUID()}`;
	const db = await SignalDB.open<Schema>(name, {
		version: 1,
		upgrade(database) {
			database.createObjectStore("notes", { keyPath: "id" });
		},
	});
	const peer = await DB.open<Schema>(name);
	const note: Note = { id: "one", text: "First" };
	const initialRead = Promise.withResolvers<Note | undefined>();
	const getSpy = vi.spyOn(db.source, "get").mockReturnValueOnce(initialRead.promise);
	const query = db.watch("notes", note.id);
	const container = document.createElement("div");
	const mounted = mountDraftEditor(query, container, (value) => value.text);

	document.body.append(container);

	try {
		expect(mounted.state.get()).toEqual({ current: { status: "pending" }, snapshot: undefined });
		expect(container.querySelector("[role=status]")?.textContent).toBe("Loading…");
		expect(container.querySelector("textarea")).toBeNull();

		await peer.put("notes", note);
		initialRead.resolve(await db.source.get("notes", note.id));

		await expect.poll(() => container.querySelector("h2")?.textContent).toBe(note.text);

		const textarea = container.querySelector("textarea")!;

		textarea.value = "Unsent comment";
		textarea.focus();

		const updated: Note = { ...note, text: "Edited by a peer" };
		const refreshed = Promise.withResolvers<Note | undefined>();

		getSpy.mockReturnValueOnce(refreshed.promise);

		await peer.put("notes", updated);
		// Direct databases require an explicit bridge for writes through other connections.
		db.invalidate("notes");

		await expect.poll(() => container.querySelector("[role=status]")?.textContent).toBe("Refreshing…");
		expect(mounted.state.get()).toEqual({ current: { status: "pending" }, snapshot: ready(note) });
		expect(container.querySelector("textarea")).toBe(textarea);
		expect(textarea.value).toBe("Unsent comment");
		expect(document.activeElement).toBe(textarea);

		refreshed.resolve(await db.source.get("notes", note.id));

		await expect.poll(() => container.querySelector("h2")?.textContent).toBe(updated.text);
		expect(container.querySelector("textarea")).toBe(textarea);
		expect(textarea.value).toBe("Unsent comment");
		expect(document.activeElement).toBe(textarea);

		const error = new Error("Read failed");

		getSpy.mockRejectedValueOnce(error);

		await query.refresh();
		await expect
			.poll(() => container.querySelector("[role=status]")?.textContent)
			.toBe("Query failed: Error: Read failed");
		expect(mounted.state.get()).toEqual({ current: { status: "error", error }, snapshot: ready(updated) });
		expect(container.querySelector("textarea")).toBe(textarea);
		expect(textarea.value).toBe("Unsent comment");

		await peer.delete("notes", note.id);
		db.invalidate("notes");

		await expect.poll(() => container.querySelector("[role=status]")?.textContent).toBe("Record not found.");
		expect(mounted.state.get()).toEqual({ current: ready(undefined), snapshot: ready(undefined) });
		expect(container.querySelector("textarea")).toBeNull();

		await db.put("notes", note);
		await expect.poll(() => container.querySelector("h2")?.textContent).toBe(note.text);

		const lateRead = Promise.withResolvers<Note | undefined>();

		getSpy.mockReturnValueOnce(lateRead.promise);

		const refreshing = query.refresh();

		await expect.poll(() => container.querySelector("[role=status]")?.textContent).toBe("Refreshing…");

		const retired = mounted.state.get();

		mounted.dispose();
		lateRead.resolve(updated);

		await refreshing;
		await lateRead.promise;

		expect(mounted.state.get()).toBe(retired);
		expect(container.childElementCount).toBe(0);
		expect(Signal.subtle.hasSinks(query)).toBe(false);
		await expect(query.refresh()).rejects.toMatchObject({ name: "InvalidStateError" });
	} finally {
		mounted.dispose();
		getSpy.mockRestore();
		container.remove();
		peer.close();
		db.close();

		await DB.delete(name);
	}
});

test("the editor recipe cleans up when its initial render throws", async () => {
	const name = `signal-db-draft-error-${crypto.randomUUID()}`;
	const db = await SignalDB.open<Schema>(name, {
		version: 1,
		upgrade(database) {
			database.createObjectStore("notes", { keyPath: "id" });
		},
	});
	const note: Note = { id: "one", text: "First" };
	const container = document.createElement("div");

	try {
		await db.put("notes", note);

		const query = db.watch("notes", note.id);

		await expect.poll(() => query.get()).toEqual(ready(note));

		const failure = new Error("Initial render failed");

		expect(() =>
			mountDraftEditor(query, container, () => {
				throw failure;
			}),
		).toThrow(failure);
		expect(container.childElementCount).toBe(0);
		expect(Signal.subtle.hasSinks(query)).toBe(false);
		await expect(query.refresh()).rejects.toMatchObject({ name: "InvalidStateError" });
	} finally {
		container.remove();
		db.close();

		await DB.delete(name);
	}
});
