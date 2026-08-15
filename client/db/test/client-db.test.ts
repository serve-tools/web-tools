import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB } from "../src/client-db.js";

interface Schema {
	users: DB.Store<{ id: string; name: string }, string, { byName: string }>;
	logs: DB.Store<string, number>;
}

const collect = async <Value>(values: AsyncIterable<Value>): Promise<Value[]> => {
	const collected: Value[] = [];

	for await (const value of values) {
		collected.push(value);
	}

	return collected;
};

class Request<Result> {
	error: DOMException | null = null;
	onerror: ((event: Event) => void) | null = null;
	onsuccess: ((event: Event) => void) | null = null;
	result!: Result;

	succeed(value: Result): this {
		this.result = value;
		queueMicrotask(() => this.onsuccess?.(new Event("success")));

		return this;
	}
}

class Transaction {
	aborted = false;
	error: DOMException | null = null;
	readonly mode: IDBTransactionMode;
	readonly #store: Store;
	onabort: (() => void) | null = null;
	oncomplete: (() => void) | null = null;

	constructor(store: Store, mode: IDBTransactionMode = "readonly") {
		this.#store = store;
		this.mode = mode;
		setTimeout(() => this.oncomplete?.());
	}

	abort(): void {
		this.aborted = true;
		this.onabort?.();
	}

	commit(): void {
		this.oncomplete?.();
	}

	objectStore(): Store {
		return this.#store;
	}
}

class Store {
	readonly values = new Map<IDBValidKey, unknown>();
	transaction!: Transaction;

	add(value: unknown, key?: IDBValidKey): Request<IDBValidKey> {
		return this.put(value, key);
	}

	clear(): Request<undefined> {
		this.values.clear();
		return this.request(undefined);
	}

	count(): Request<number> {
		return this.request(this.values.size);
	}

	delete(key: IDBValidKey): Request<undefined> {
		this.values.delete(key);
		return this.request(undefined);
	}

	get(key: IDBValidKey): Request<unknown> {
		return this.request(this.values.get(key));
	}

	getAll(): Request<unknown[]> {
		return this.request([...this.values.values()]);
	}

	getAllKeys(): Request<IDBValidKey[]> {
		return this.request([...this.values.keys()]);
	}

	getKey(key: IDBValidKey): Request<IDBValidKey | undefined> {
		return this.request(this.values.has(key) ? key : undefined);
	}

	index(): Store {
		return this;
	}

	put(value: unknown, key?: IDBValidKey): Request<IDBValidKey> {
		const resolved = key ?? (value as { id: IDBValidKey }).id;

		this.values.set(resolved, value);
		return this.request(resolved);
	}

	private request<Result>(value: Result): Request<Result> {
		const request = new Request<Result>().succeed(value);

		(request as Request<Result> & { transaction: Transaction }).transaction = this.transaction;
		return request;
	}
}

describe("DB", () => {
	const store = new Store();
	const source = {
		name: "app",
		close: vi.fn(),
		createObjectStore: vi.fn(() => store),
		onclose: null,
		onversionchange: null,
		transaction: vi.fn((_names: string | string[], mode?: IDBTransactionMode) => {
			const transaction = new Transaction(store, mode);

			store.transaction = transaction;
			return transaction;
		}),
	};
	const open = vi.fn((_name: string, _version?: number) => {
		const request = new Request<typeof source>() as Request<typeof source> & {
			onblocked: ((event: Event) => void) | null;
			onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null;
			transaction: Transaction;
		};

		request.onblocked = null;
		request.onupgradeneeded = null;
		request.transaction = new Transaction(store, "versionchange");
		request.result = source;
		queueMicrotask(() => {
			request.onupgradeneeded?.({ newVersion: 2, oldVersion: 1 } as IDBVersionChangeEvent);
			request.onsuccess?.(new Event("success"));
		});

		return request;
	});

	beforeEach(() => {
		store.values.clear();
		vi.clearAllMocks();
		vi.stubGlobal("indexedDB", { cmp: vi.fn(), deleteDatabase: vi.fn(), open });
	});

	afterEach(() => vi.unstubAllGlobals());

	it("opens with native version and upgrade semantics", async () => {
		const upgrade = vi.fn((database) => database.createObjectStore("users", { keyPath: "id" }));
		const db = await DB.open<Schema>("app", { version: 2, upgrade });

		expect(open).toHaveBeenCalledWith("app", 2);
		expect(upgrade).toHaveBeenCalledWith(
			source,
			expect.objectContaining({ newVersion: 2, oldVersion: 1, transaction: expect.any(Transaction) }),
		);
		db.close();
	});

	it("provides promise-based point operations", async () => {
		const db = await DB.open<Schema>("app");

		await db.add("users", { id: "1", name: "Ada" });
		await db.put("users", { id: "2", name: "Grace" });

		expect(await db.get("users", "1")).toEqual({ id: "1", name: "Ada" });
		expect(await db.has("users", "1")).toBe(true);
		expect(await db.getAll("users")).toEqual([
			{ id: "1", name: "Ada" },
			{ id: "2", name: "Grace" },
		]);
		expect(await db.getAllKeys("users")).toEqual(["1", "2"]);
		expect(await db.count("users")).toBe(2);

		await db.delete("users", "1");
		expect(await db.has("users", "1")).toBe(false);

		await db.clear("users");
		expect(await db.count("users")).toBe(0);

		db.close();
	});

	it("aborts an in-flight operation with its signal reason", async () => {
		const db = await DB.open<Schema>("app");
		const controller = new AbortController();
		const reason = new Error("cancelled");
		const operation = db.get("users", "1", { signal: controller.signal });
		const transaction = source.transaction.mock.results.at(-1)!.value;

		controller.abort(reason);

		await expect(operation).rejects.toBe(reason);
		expect(transaction.aborted).toBe(true);
		db.close();
	});

	it("scans records in a committed page", async () => {
		const db = await DB.open<Schema>("app");

		store.values.set("1", { id: "1", name: "Ada" });
		store.values.set("2", { id: "2", name: "Grace" });

		expect(await collect(db.scan("users", { batchSize: 10, limit: 3 }))).toEqual([
			{ key: "1", value: { id: "1", name: "Ada" } },
			{ key: "2", value: { id: "2", name: "Grace" } },
		]);
		expect(await collect(db.scanKeys("users", { batchSize: 10, limit: 3 }))).toEqual(["1", "2"]);
		expect(await collect(db.scanValues("users", { batchSize: 10, limit: 3 }))).toEqual([
			{ id: "1", name: "Ada" },
			{ id: "2", name: "Grace" },
		]);

		db.close();
	});

	it("keeps transactional store operations promise-based", async () => {
		const db = await DB.open<Schema>("app");

		const value = await db.transaction(["users", "logs"], { mode: "readwrite" }, async (transaction) => {
			const users = transaction.objectStore("users");

			await users.put({ id: "1", name: "Ada" });
			expect(await users.index("byName").has("Ada")).toBe(false);

			return users.get("1");
		});

		expect(value).toEqual({ id: "1", name: "Ada" });

		db.close();
	});

	it("uses DB-prefixed constructors for exposed runtime handles", async () => {
		const db = await DB.open<Schema>("app");
		const transaction = db.transaction("users");
		const store = transaction.objectStore("users");
		const index = store.index("byName");

		expect(db.constructor.name).toBe("DB");
		expect(transaction.constructor.name).toBe("DBTransaction");
		expect(store.constructor.name).toBe("DBObjectStore");
		expect(index.constructor.name).toBe("DBQuery");

		await transaction.done;
		db.close();
	});
});
