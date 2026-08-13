/// <reference lib="dom" />

import { expect, test } from "vitest";

import { benchmark } from "../../benchmark.js";
import { Storage } from "../src/client-storage.js";

interface Schema {
	"serve-tools-benchmark": string;
}

const key = "serve-tools-benchmark";

test("Web Storage wrapper overhead", async () => {
	const storage = new Storage<Schema>();
	let value = 0;

	storage.delete(key);

	try {
		expect(storage.set(key, "ready")).toBe(true);
		expect(storage.get(key)).toBe("ready");

		await benchmark(
			"native-local-storage/set-get",
			() => {
				localStorage.setItem(key, String(value++));
				localStorage.getItem(key);
			},
			{ iterations: 10_000 },
		);

		await benchmark(
			"client-storage/set-get",
			() => {
				storage.set(key, String(value++));
				storage.get(key);
			},
			{ iterations: 10_000 },
		);
	} finally {
		storage.delete(key);
	}
});

test("Web Storage subscription fanout", async () => {
	const storage = new Storage<Schema>();
	const subscriptions = Array.from({ length: 100 }, () => storage.subscribe(key, () => undefined));
	let value = 0;

	try {
		await benchmark(
			"client-storage/set-100-subscribers",
			() => {
				storage.set(key, String(value++));
			},
			{ iterations: 1_000 },
		);
	} finally {
		subscriptions.forEach((unsubscribe) => {
			unsubscribe();
		});
		storage.delete(key);
	}
});
