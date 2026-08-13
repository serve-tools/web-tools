/// <reference lib="dom" />

import { expect, test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { DB } from "../src/client-db.js";

interface RecordValue {
	id: number;
	value: string;
}

interface Schema {
	records: DB.Store<RecordValue, number>;
}

test("IndexedDB point reads and writes", async () => {
	const name = `client-db-benchmark-${crypto.randomUUID()}`;
	const db = await DB.open<Schema>(name, {
		version: 1,
		upgrade(database) {
			database.createObjectStore("records", { keyPath: "id" });
		},
	});

	try {
		await db.put("records", { id: 0, value: "seed" });
		expect(await db.get("records", 0)).toEqual({ id: 0, value: "seed" });

		await benchmark(
			"client-db/get",
			async () => {
				await db.get("records", 0);
			},
			{ iterations: 1_000 },
		);

		let id = 1;

		await benchmark(
			"client-db/put",
			async () => {
				await db.put("records", { id: id++, value: "value" });
			},
			{ iterations: 500 },
		);
	} finally {
		db.close();
		await DB.delete(name);
	}
});

test("IndexedDB batched transaction throughput", async () => {
	const name = `client-db-benchmark-${crypto.randomUUID()}`;
	const db = await DB.open<Schema>(name, {
		version: 1,
		upgrade(database) {
			database.createObjectStore("records", { keyPath: "id" });
		},
	});
	let id = 0;

	try {
		await benchmark(
			"client-db/transaction-100-puts",
			async () => {
				await db.transaction("records", { mode: "readwrite" }, async (transaction) => {
					const store = transaction.objectStore("records");

					for (let index = 0; index < 100; ++index) {
						await store.put({ id: id++, value: "value" });
					}
				});
			},
			{ iterations: 10, samples: 10, warmup: 3 },
		);

		expect(await db.count("records")).toBe(id);
	} finally {
		db.close();
		await DB.delete(name);
	}
});
