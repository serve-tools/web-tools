import { describe, expect, it, vi } from "vitest";
import type { StorageChange } from "../src/client-storage.js";
import { Storage } from "../src/client-storage.js";

interface Schema {
	locale: string;
	theme: "light" | "dark";
	token: string;
}

class MemoryStorage {
	readonly #values = new Map<string, string>();

	get length(): number {
		return this.#values.size;
	}

	clear(): void {
		this.#values.clear();
	}

	getItem(key: string): string | null {
		return this.#values.get(key) ?? null;
	}

	key(index: number): string | null {
		return [...this.#values.keys()][index] ?? null;
	}

	removeItem(key: string): void {
		this.#values.delete(key);
	}

	setItem(key: string, value: string): void {
		this.#values.set(key, value);
	}
}

class StorageWindow {
	readonly localStorage = new MemoryStorage();
	readonly sessionStorage = new MemoryStorage();
	readonly #listeners = new Set<(event: StorageEvent) => void>();

	get listenerCount(): number {
		return this.#listeners.size;
	}

	addEventListener(type: string, listener: (event: StorageEvent) => void): void {
		if (type === "storage") this.#listeners.add(listener);
	}

	removeEventListener(type: string, listener: (event: StorageEvent) => void): void {
		if (type === "storage") this.#listeners.delete(listener);
	}

	emit(event: Partial<StorageEvent> & Pick<StorageEvent, "key" | "newValue" | "oldValue" | "storageArea">): void {
		for (const listener of [...this.#listeners]) listener(event as StorageEvent);
	}
}

const setup = (type: "local" | "session" = "local") => {
	const target = new StorageWindow();
	const storage = new Storage<Schema>(type, target as unknown as Window);

	return { storage, target };
};

describe("Storage", () => {
	it("provides typed map-like point operations for local and session storage", () => {
		const { storage, target } = setup();

		expect(storage.size).toBe(0);
		expect(storage.get("theme")).toBeNull();
		expect(storage.has("theme")).toBe(false);
		expect(storage.set("theme", "light")).toBe(true);
		expect(storage.set("theme", "light")).toBe(false);
		expect(storage.get("theme")).toBe("light");
		expect(storage.has("theme")).toBe(true);
		expect(storage.size).toBe(1);
		expect(storage.delete("theme")).toBe(true);
		expect(storage.delete("theme")).toBe(false);

		const session = new Storage<Schema>("session", target as unknown as Window);

		session.set("token", "temporary");
		expect(target.sessionStorage.getItem("token")).toBe("temporary");
		expect(target.localStorage.getItem("token")).toBeNull();
	});

	it("delivers exact local changes and removes the platform listener after unsubscribe", () => {
		const { storage, target } = setup();
		const changes: StorageChange<"theme", "light" | "dark">[] = [];
		const unsubscribe = storage.subscribe("theme", (change) => changes.push(change));

		expect(target.listenerCount).toBe(1);
		storage.set("theme", "light");
		storage.set("theme", "dark");
		storage.delete("theme");
		expect(changes).toEqual([
			{ kind: "added", key: "theme", value: "light" },
			{ kind: "updated", key: "theme", previous: "light", value: "dark" },
			{ kind: "removed", key: "theme", previous: "dark" },
		]);

		unsubscribe();
		unsubscribe();
		expect(target.listenerCount).toBe(0);
		storage.set("theme", "light");
		expect(changes).toHaveLength(3);
	});

	it("observes other-document changes and ignores unrelated storage areas", () => {
		const { storage, target } = setup();
		const changes: StorageChange<"token">[] = [];

		storage.subscribe("token", (change) => changes.push(change));
		target.emit({
			key: "token",
			newValue: "ignored",
			oldValue: null,
			storageArea: target.sessionStorage as unknown as globalThis.Storage,
		});
		target.emit({
			key: "token",
			newValue: "one",
			oldValue: null,
			storageArea: target.localStorage as unknown as globalThis.Storage,
		});
		target.emit({
			key: "token",
			newValue: "two",
			oldValue: "one",
			storageArea: target.localStorage as unknown as globalThis.Storage,
		});
		target.emit({
			key: "token",
			newValue: null,
			oldValue: "two",
			storageArea: target.localStorage as unknown as globalThis.Storage,
		});

		expect(changes).toEqual([
			{ kind: "added", key: "token", value: "one" },
			{ kind: "updated", key: "token", previous: "one", value: "two" },
			{ kind: "removed", key: "token", previous: "two" },
		]);
	});

	it("invalidates the subscription snapshot when storage is cleared", () => {
		const { storage, target } = setup();
		const calls: string[] = [];

		storage.set("theme", "light");
		storage.set("locale", "en");
		storage.subscribe("theme", (change) => {
			calls.push(`theme:${change.kind}`);
			storage.subscribe("locale", (nested) => calls.push(`late:${nested.kind}`));
		});
		storage.subscribe("locale", (change) => calls.push(`locale:${change.kind}`));

		expect(storage.clear()).toBe(true);
		expect(storage.clear()).toBe(false);
		expect(storage.size).toBe(0);
		expect(calls).toEqual(["theme:invalidated", "locale:invalidated"]);

		target.emit({
			key: null,
			newValue: null,
			oldValue: null,
			storageArea: target.localStorage as unknown as globalThis.Storage,
		});
		expect(calls).toEqual([
			"theme:invalidated",
			"locale:invalidated",
			"theme:invalidated",
			"locale:invalidated",
			"late:invalidated",
		]);
	});

	it("uses snapshot delivery while honoring reentrant unsubscription", () => {
		const { storage } = setup();
		const calls: string[] = [];
		let added = false;
		let unsubscribeSecond = () => {};

		storage.subscribe("theme", () => {
			calls.push("first");

			if (!added) {
				added = true;
				unsubscribeSecond();
				storage.subscribe("theme", () => calls.push("third"));
			}
		});
		unsubscribeSecond = storage.subscribe("theme", () => calls.push("second"));

		storage.set("theme", "light");
		expect(calls).toEqual(["first"]);
		storage.set("theme", "dark");
		expect(calls).toEqual(["first", "first", "third"]);
	});

	it("supports abortable subscriptions", () => {
		const { storage, target } = setup();
		const alreadyAborted = new AbortController();
		const subscriber = vi.fn();

		alreadyAborted.abort();
		storage.subscribe("token", subscriber, { signal: alreadyAborted.signal });
		expect(target.listenerCount).toBe(0);

		const controller = new AbortController();

		storage.subscribe("token", subscriber, { signal: controller.signal });
		expect(target.listenerCount).toBe(1);
		controller.abort();
		expect(target.listenerCount).toBe(0);
		storage.set("token", "value");
		expect(subscriber).not.toHaveBeenCalled();
	});

	it("commits mutations before combining subscriber failures", () => {
		const { storage } = setup();
		const first = new Error("first");
		const second = new Error("second");
		const completed = vi.fn();

		storage.subscribe("token", () => {
			throw first;
		});
		storage.subscribe("token", completed);
		storage.subscribe("token", () => {
			throw second;
		});

		let thrown: unknown;

		try {
			storage.set("token", "committed");
		} catch (error) {
			thrown = error;
		}

		expect(storage.get("token")).toBe("committed");
		expect(completed).toHaveBeenCalledOnce();
		expect(thrown).toBeInstanceOf(AggregateError);
		expect((thrown as AggregateError).errors).toEqual([first, second]);

		const { storage: singleFailure } = setup();

		singleFailure.subscribe("token", () => {
			throw first;
		});
		thrown = undefined;

		try {
			singleFailure.set("token", "committed");
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBe(first);
	});
});
