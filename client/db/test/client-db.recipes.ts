import { DB } from "../src/client-db.js";

interface NotesSchema {
	notes: DB.Store<{ id: string; body: string; updatedAt: number }, string, { byUpdatedAt: number }>;
}

/** A compile-tested schema, migration, transaction, and scan recipe. */
export async function databaseRecipe(signal: AbortSignal): Promise<void> {
	await using db = await DB.open<NotesSchema>("notes", {
		version: 1,
		upgrade(database) {
			const notes = database.createObjectStore("notes", { keyPath: "id" });
			notes.createIndex("byUpdatedAt", "updatedAt");
		},
	});

	await db.put("notes", { id: "welcome", body: "Hello", updatedAt: Date.now() }, { signal });

	await db.transaction("notes", { mode: "readwrite", signal }, async (transaction) => {
		const notes = transaction.objectStore("notes");
		const note = await notes.get("welcome");

		if (note) {
			await notes.put({ ...note, body: "Hello again" });
		}
	});

	for await (const { value } of db.scan("notes", { batchSize: 50, signal })) {
		console.log(value.body);
	}
}
