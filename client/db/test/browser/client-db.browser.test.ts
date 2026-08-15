/// <reference lib="dom" />

import { expect, test } from "vitest";

import { DB } from "../../src/client-db.js";

interface Contact {
	readonly email: string;
	readonly id: string;
	readonly name: string;
}

interface Schema {
	contacts: DB.Store<Contact, string, { byEmail: string }>;
	visits: DB.Store<{ contactID: string }, number>;
}

const collect = async <Value>(values: AsyncIterable<Value>): Promise<Value[]> => {
	const collected: Value[] = [];

	for await (const value of values) {
		collected.push(value);
	}

	return collected;
};

test("uses native IndexedDB requests, transactions, indexes, and paged scans", async () => {
	const name = `client-db-test-${crypto.randomUUID()}`;
	const db = await DB.open<Schema>(name, {
		version: 1,
		upgrade(database) {
			const contacts = database.createObjectStore("contacts", { keyPath: "id" });

			contacts.createIndex("byEmail", "email", { unique: true });
			database.createObjectStore("visits", { autoIncrement: true });
		},
	});

	try {
		await db.add("contacts", { id: "ada", email: "ada@example.com", name: "Ada" });
		await db.put("contacts", { id: "grace", email: "grace@example.com", name: "Grace" });
		await db.put("contacts", { id: "katherine", email: "katherine@example.com", name: "Katherine" });

		const visitKey = await db.transaction(["contacts", "visits"], { mode: "readwrite" }, async (transaction) => {
			const contact = await transaction.objectStore("contacts").index("byEmail").get("ada@example.com");

			expect(contact?.id).toBe("ada");

			return transaction.objectStore("visits").add({ contactID: contact!.id });
		});

		expect(visitKey).toBe(1);
		expect(await db.count("contacts")).toBe(3);
		expect(await collect(db.scanKeys("contacts", { batchSize: 1, direction: "prev", limit: 2 }))).toEqual([
			"katherine",
			"grace",
		]);
	} finally {
		db.close();
		await DB.delete(name);
	}
});

test("rejects an operation whose signal is already aborted", async () => {
	const name = `client-db-test-${crypto.randomUUID()}`;
	const db = await DB.open<Schema>(name, {
		version: 1,
		upgrade(database) {
			database.createObjectStore("contacts", { keyPath: "id" });
			database.createObjectStore("visits", { autoIncrement: true });
		},
	});
	const controller = new AbortController();
	const reason = new Error("cancelled before the transaction opened");

	controller.abort(reason);

	try {
		await expect(db.get("contacts", "ada", { signal: controller.signal })).rejects.toBe(reason);
	} finally {
		db.close();
		await DB.delete(name);
	}
});
