/// <reference lib="dom" />

import { expect, test, vi } from "vitest";

import { Storage, type StorageChange } from "../../src/client-storage.js";

interface Schema {
	"client-storage-test-theme": "light" | "dark";
	"client-storage-test-token": string;
}

test("reads, writes, and synchronously observes native local storage", () => {
	const storage = new Storage<Schema>();
	const key = "client-storage-test-theme";
	const changes: StorageChange<typeof key, "light" | "dark">[] = [];

	storage.delete(key);
	const unsubscribe = storage.subscribe(key, (change) => changes.push(change));

	try {
		expect(storage.set(key, "light")).toBe(true);
		expect(storage.set(key, "light")).toBe(false);
		expect(storage.set(key, "dark")).toBe(true);
		expect(storage.get(key)).toBe("dark");
		expect(storage.delete(key)).toBe(true);
		expect(changes).toEqual([
			{ kind: "added", key, value: "light" },
			{ kind: "updated", key, previous: "light", value: "dark" },
			{ kind: "removed", key, previous: "dark" },
		]);
	} finally {
		unsubscribe();
		storage.delete(key);
	}
});

test("observes platform events and aborts subscriptions", () => {
	const storage = new Storage<Schema>();
	const key = "client-storage-test-token";
	const subscriber = vi.fn();
	const controller = new AbortController();

	storage.subscribe(key, subscriber, { signal: controller.signal });
	window.dispatchEvent(
		new StorageEvent("storage", {
			key,
			newValue: "from-another-document",
			oldValue: null,
			storageArea: localStorage,
			url: location.href,
		}),
	);

	expect(subscriber).toHaveBeenCalledWith({ kind: "added", key, value: "from-another-document" });

	controller.abort();
	storage.set(key, "local");
	expect(subscriber).toHaveBeenCalledOnce();
	storage.delete(key);
});

test("keeps local and session storage isolated", () => {
	const key = "client-storage-test-token";
	const local = new Storage<Schema>();
	const session = new Storage<Schema>("session");

	local.delete(key);
	session.delete(key);

	try {
		local.set(key, "local");
		session.set(key, "session");

		expect(local.get(key)).toBe("local");
		expect(session.get(key)).toBe("session");
	} finally {
		local.delete(key);
		session.delete(key);
	}
});
